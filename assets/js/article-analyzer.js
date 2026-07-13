// BOTWAVEBOMBA — Per-Article Analyzer (W15)
// Browser-side factuality heuristic + BLOC and AXIS frame extraction.
// Operates on the per-article snippets that the full payload
// (api/latest.json) ships, one record per source covering the same event.
//
// Two functions:
//
//   1. _scoreArticleFactuality — 0-100 factuality score from snippet
//      text. Generic heuristic: citations, attribution, named sources,
//      numbers/dates, quotes, hedging, sensational, opinion, extreme
//      adverbs. Pure signal, no US-specific political vocabulary.
//
//   2. _extractFrameFromText — bloc-coded frame + 5-axis frame.
//      NOT L/C/R (Ground News's frame, redundant with our existing
//      source-level bias_bucket). Instead:
//        BLOC:   western / non-aligned / adversarial
//                — what information-bloc's editorial posture does the
//                article's word choice align with?
//        AXIS:   interventionist / zionist / atlanticist / statist /
//                financialized
//                — what worldview axis does the article signal?
//      Both are independent dimensions; an article can be "western +
//      interventionist + zionist" or "non-aligned + anti-statist" etc.
//
// Both functions are deterministic, pure, side-effect free. The per-
// source registry factuality remains the trusted signal; the W15
// heuristic only fires when the article text disagrees with the
// registry rating, in which case the chrome surfaces the delta.

(function () {
  'use strict';

  // ── BLOC-CODED FRAME DICTIONARY (Western / Non-Aligned / Adversarial) ─────
  // Lexical cues that signal the editorial frame a story is being told in.
  // Weights hand-tuned against the 119-story corpus (see W15 ISA).
  //
  // IMPORTANT — this is BWB's own frame model, not Ground News's L/C/R.
  // Rationale (per the operator, 2026-07-08): the more interesting and
  // politically-loaded bias signal is *which information bloc* an article
  // aligns with, not which domestic L/R pole. Western press funded by
  // the same super-donor class (Adelson, Koch, Bloomberg, etc.) carry
  // shared editorial postures — those postures are what the L/C/R
  // axis collapses to "right" or "center", but the actual frame is
  // "western super-donor funded". BWB's differentiator is naming that.
  var FRAME_DICT = {
    // WESTERN-coded: framing of US/NATO/EU actors as legitimate, allied,
    // rule-based, defensive, free. "Regime" pejorative reserved for
    // adversaries. Sanctions framed as law enforcement, not coercion.
    // "Concerned" / "warned" voice for own-side, "threatens" / "regime"
    // for the other side.
    western: {
      'regime': 2, 'regimes': 2, 'dictator': 2, 'dictatorship': 2, 'authoritarian regime': 3,
      'kremlin': 1, 'the kremlin': 1, 'beijing': 1, 'tehran': 1,
      'axis of evil': 3, 'rogue state': 3, 'pariah state': 2,
      'threatening': 2, 'threatens': 2, 'threat': 1, 'threats': 1,
      'invasion': 2, 'invaded': 2, 'annexation': 2, 'annexed': 2,
      'war crimes': 1, 'atrocities': 1, 'genocide': 1,
      'occupation': 1, 'occupied': 1,
      'defensive': 2, 'defensive weapons': 3, 'defensive aid': 2,
      'rules-based order': 3, 'rules based order': 3, 'international rules': 2,
      'democracy': 1, 'democracies': 1, 'democratic': 1, 'free world': 2, 'free nations': 2,
      'sanctions': 1, 'punitive measures': 2, 'magnitsky': 1,
      'state-sponsored': 2, 'state sponsored': 2, 'state media': 2,
      'propaganda': 1, 'disinformation': 1, 'fake news': 1,
      'concerned': 1, 'expressed concern': 2, 'voiced concern': 2, 'deeply concerned': 2,
      'warned': 1, 'warning': 1, 'cautioned': 1, 'condemned': 1, 'condemns': 1,
      'allies': 1, 'ally': 1, 'allied': 1, 'partner': 1, 'partners': 1, 'partnership': 1,
      'nato': 1, 'eu': 1, 'g7': 1, 'g20': 1, 'un security council': 1,
      'sovereignty': 1, 'territorial integrity': 2, 'sovereign': 1,
      'human rights': 1, 'rule of law': 1, 'due process': 1,
      'election interference': 2, 'meddling': 1,
      'expelled diplomats': 2, 'diplomatic expulsions': 2,
      'weapons of mass destruction': 3, 'wmd': 3, 'chemical weapons': 2,
      'terrorist organization': 2, 'terror group': 2, 'militant group': 2,
      'axis of evil': 3, 'evil empire': 3, 'evildoers': 3,
      'regime change': 3, 'color revolution': 3,
      'deterrence': 1, 'containment': 1,
      'nuclear program': 1, 'nuclear ambitions': 2, 'nuclear threat': 2,
      'defended': 1, 'defending': 1, 'protection': 1, 'protecting': 1,
      'liberated': 2, 'freeing': 2, 'rescue': 1, 'rescued': 1,
      'ceasefire violations': 2, 'cease-fire violations': 2,
      'iranian-backed': 2, 'russian-backed': 2, 'chinese-backed': 2,
      'proxy forces': 2, 'proxies': 1, 'militias': 1, 'militia': 1,
      'foreign fighters': 2, 'jihadists': 2,
      'blockade': 1, 'embargo': 1,
      'peace plan': 1, 'peace deal': 1, 'peace process': 1,
      'biden administration': 1, 'trump administration': 1, 'white house': 1, 'state department': 1, 'pentagon': 1, 'us military': 1, 'us forces': 1,
      'zelenskyy': 1, 'zelensky': 1, 'ukraine': 1, 'kyiv': 1,
      'israeli military': 1, 'idf': 1, 'defense forces': 1,
      'united states': 1, 'american': 1, 'british': 1, 'french': 1, 'german': 1, 'european': 1, 'western': 1
    },
    // NON-ALIGNED-coded: BRICS+ / Global South framing. Sovereignty-first,
    // anti-interventionist, multi-polar, "the West" as actor (not
    // passive subject), "NATO expansion" as cause (not "invasion" as effect).
    // Cites UN, AfDB, ASEAN, AU, BRICS Summit.
    'non-aligned': {
      'multipolar': 3, 'multi-polar': 3, 'multipolarity': 3,
      'global south': 3, 'global south countries': 3, 'developing nations': 2,
      'brics': 2, 'brics+': 2, 'brics summit': 3, 'sco': 2, 'shanghai cooperation': 2,
      'asean': 1, 'african union': 2, 'au': 1, 'celac': 2, 'caricom': 2,
      'non-aligned': 3, 'non-alignment': 3, 'non aligned movement': 3,
      'sovereignty': 1, 'sovereign': 1, 'territorial integrity': 1,
      'self-determination': 2, 'right to development': 2,
      'west': 1, 'western': 1, 'western powers': 2, 'western hegemony': 3,
      'hegemony': 2, 'hegemonic': 2, 'unipolar': 2, 'unipolarity': 2,
      'nato expansion': 3, 'nato encroachment': 3, 'nato aggression': 3,
      'us intervention': 3, 'us aggression': 3, 'western intervention': 3, 'foreign intervention': 2,
      'illegal occupation': 3, 'occupation forces': 2,
      'sanctions': 1, 'unilateral sanctions': 3, 'illegal sanctions': 3, 'coercive measures': 2,
      'sovereign equality': 3, 'equal sovereignty': 3,
      'south-south': 3, 'south south cooperation': 3,
      'africa': 1, 'asian': 1, 'latin american': 1, 'arab': 1, 'african': 1,
      'de-dollarization': 3, 'de-dollarisation': 3, 'dedollarization': 3, 'currency sovereignty': 3,
      'brics bank': 2, 'new development bank': 2, 'aib': 2,
      'non-interference': 3, 'internal affairs': 2,
      'colonial': 1, 'colonialism': 1, 'neo-colonial': 2, 'neocolonialism': 2, 'post-colonial': 2,
      'imperialism': 2, 'imperial': 1,
      'g77': 2, 'group of 77': 2,
      'world majority': 3, 'global majority': 3,
      'putin': 1, 'xi jinping': 1, 'modi': 1, 'erdogan': 1, 'lula': 1,
      'russia': 1, 'china': 1, 'iran': 1, 'india': 1, 'brazil': 1, 'south africa': 1,
      'south-south': 3, 'east-west': 1
    },
    // ADVERSARIAL-coded: explicit anti-Western framing, realpolitik,
    // "Anglo-Saxon", "the empire", NATO-as-aggressor, US-as-occupier.
    // Cites Sputnik, RT, CGTN, IRNA, Xinhua voice.
    adversarial: {
      'the west': 2, 'the western': 2, 'anglo-saxon': 3, 'anglo saxon': 3,
      'empire': 2, 'imperial': 2, 'imperialism': 3, 'empire of lies': 4, 'empire of chaos': 4,
      'hegemon': 2, 'hegemony': 2, 'hegemonic': 2,
      'us hegemony': 3, 'western hegemony': 3, 'american hegemony': 3,
      'us empire': 3, 'american empire': 3, 'western empire': 3,
      'colonial power': 3, 'colonial powers': 3, 'colonizer': 3, 'colonizers': 3,
      'nato aggression': 4, 'nato expansion': 3, 'nato encroachment': 3, 'nato threat': 3,
      'us aggression': 4, 'us occupation': 4, 'us military presence': 3, 'us bases': 3, 'us troops': 2,
      'western aggression': 3, 'western occupation': 3,
      'puppet regime': 4, 'puppet government': 4, 'kiev regime': 4, 'kyiv regime': 4,
      'color revolution': 4, 'colored revolution': 3, 'maidan': 3, 'euromaidan': 3,
      'regime change': 3, 'regime-change': 3,
      'biolabs': 3, 'biological weapons': 3, 'bioweapons': 3, 'bioweapons labs': 4,
      'us biolabs': 4, 'pentagon biolabs': 4,
      'us propaganda': 3, 'western propaganda': 3, 'mainstream media lies': 4, 'msm lies': 4,
      'lies of the west': 4, 'lies of washington': 4,
      'war crimes': 1, 'us war crimes': 3, 'nato war crimes': 3, 'israeli war crimes': 2,
      'genocide': 1, 'us-backed genocide': 4, 'us-backed israel': 3,
      'double standards': 3, 'western double standards': 4, 'hypocrisy': 2, 'us hypocrisy': 3, 'western hypocrisy': 3,
      'unipolar world': 3, 'unipolarity': 3, 'multipolar': 3,
      'dollar weapon': 3, 'weaponizing the dollar': 3, 'dollar hegemony': 3,
      'color revolutions': 4, 'orchestrated': 2, 'engineered': 1, 'manufactured crisis': 3,
      'cold war': 1, 'new cold war': 2,
      'containment': 1, 'encirclement': 2, 'containment of russia': 3, 'containment of china': 3,
      'regime': 1, 'puppet': 2, 'stooge': 2,
      'west': 1, 'us': 1, 'american': 1, 'nato': 1,
      'fascist': 2, 'fascists': 2, 'neo-nazi': 3, 'neonazi': 3, 'azov': 3,
      'banderites': 4, 'banderite': 4,
      'putin': 1, 'xi': 1, 'xi jinping': 1, 'beijing': 1, 'kremlin': 1, 'russia': 1, 'china': 1, 'iran': 1,
      'sputnik': 1, 'rt': 1, 'cgtn': 1, 'irna': 1, 'xinhua': 1, 'tass': 1, 'global times': 2, 'peoples daily': 2
    }
  };

  // Pre-compile regex once, case-insensitive word boundary.
  function _buildFrameRegex() {
    var westernWords = Object.keys(FRAME_DICT.western);
    var nonalignedWords = Object.keys(FRAME_DICT['non-aligned']);
    var adversarialWords = Object.keys(FRAME_DICT.adversarial);
    [westernWords, nonalignedWords, adversarialWords].forEach(function(arr) {
      arr.sort(function (a, b) { return b.length - a.length; });
    });
    function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    return {
      western:     new RegExp('\\b(' + westernWords.map(esc).join('|')     + ')\\b', 'gi'),
      nonAligned:  new RegExp('\\b(' + nonalignedWords.map(esc).join('|')  + ')\\b', 'gi'),
      adversarial: new RegExp('\\b(' + adversarialWords.map(esc).join('|') + ')\\b', 'gi'),
      weights: FRAME_DICT
    };
  }
  var _frameRx = _buildFrameRegex();

  // Extract BLOC frame from a chunk of text.
  // Returns { bloc: 'western'|'non-aligned'|'adversarial'|'mixed',
  //           westernScore, nonAlignedScore, adversarialScore,
  //           hits: [...], dominanceMargin }.
  //
  // 'mixed' is the default when all three are within margin-of-tie.
  // The frame a story is told in is the dominant bloc's editorial posture;
  // when an article mixes W and adversarial cues, we return the higher-
  // scoring bloc (the operator is the one who will see the delta and
  // surface "this RT story talks like the western press" via the chrome).
  function _extractBlocFromText(text) {
    if (!text || typeof text !== 'string') {
      return { bloc: 'mixed', westernScore: 0, nonAlignedScore: 0, adversarialScore: 0, hits: [] };
    }
    var wScore = 0, nScore = 0, aScore = 0;
    var hits = [];
    function scan(rx, target) {
      rx.lastIndex = 0;
      var m;
      // Map the regex key to the dictionary key (rx keys are 'nonAligned'
      // but the dict key is 'non-aligned' with a hyphen).
      var dictKey = target === 'nonAligned' ? 'non-aligned' : target;
      while ((m = rx.exec(text)) !== null) {
        var w = m[1].toLowerCase();
        var weight = _frameRx.weights[dictKey][w] || 1;
        if (target === 'western') wScore += weight;
        else if (target === 'nonAligned') nScore += weight;
        else aScore += weight;
        hits.push({ bloc: dictKey, word: w, weight: weight });
      }
    }
    scan(_frameRx.western, 'western');
    scan(_frameRx.nonAligned, 'nonAligned');
    scan(_frameRx.adversarial, 'adversarial');
    var total = wScore + nScore + aScore;
    if (total === 0) return { bloc: 'mixed', westernScore: 0, nonAlignedScore: 0, adversarialScore: 0, hits: [] };
    var scores = { western: wScore, 'non-aligned': nScore, adversarial: aScore };
    var maxBloc = 'western'; var maxScore = wScore;
    if (nScore > maxScore) { maxBloc = 'non-aligned'; maxScore = nScore; }
    if (aScore > maxScore) { maxBloc = 'adversarial'; maxScore = aScore; }
    // If two blocs are within 2 of each other, call it 'mixed' — the operator
    // can see the breakdown.
    var sortedScores = [wScore, nScore, aScore].sort(function(a, b) { return b - a; });
    var dominanceMargin = sortedScores[0] - sortedScores[1];
    if (dominanceMargin < 2) maxBloc = 'mixed';
    return {
      bloc: maxBloc,
      westernScore: wScore,
      nonAlignedScore: nScore,
      adversarialScore: aScore,
      hits: hits,
      dominanceMargin: dominanceMargin
    };
  }

  // ── 5-AXIS FRAME EXTRACTION ─────────────────────────────────────────────
  // BWB's existing 5-axis model (interventionist, zionist, atlanticist,
  // statist, financialized). Computed at the source level by the registry
  // but not at the article level. Article-level 5-axis is the
  // operator-visible differentiator: a story can have 5/5 sources
  // tagged "anti-zionist" in the registry but if 8/14 article snippets
  // say "terrorist" / "Hamas" / "militants", the article-level axis
  // is "zionist". That's the receipt.
  var AXIS_DICT = {
    interventionist: {
      // Pro-military-intervention cues
      'humanitarian intervention': 3, 'responsibility to protect': 3, 'r2p': 3,
      'military intervention': 2, 'armed intervention': 2,
      'coalition of the willing': 3, 'no-fly zone': 2, 'no fly zone': 2,
      'regime change': 2, 'liberation': 1, 'liberate': 1,
      'foreign policy': 1, 'us foreign policy': 2, 'american foreign policy': 2,
      'national security': 2, 'security interests': 2, 'vital interests': 2,
      'airstrikes': 2, 'drone strike': 2, 'drone strikes': 2, 'surgical strike': 2,
      'coalition forces': 2, 'special forces': 1, 'boots on the ground': 2,
      'troop deployment': 2, 'troop surge': 2, 'deployment': 1,
      'containment': 1, 'deterrence': 1, 'rollback': 2, 'rollback strategy': 3,
      'rogue state': 2, 'failed state': 2, 'narco-state': 2
    },
    zionist: {
      // Pro-Israel / Western-aligned framing of Israel
      'israel': 1, 'israeli': 1, 'idf': 1, 'israeli defense forces': 2,
      'jerusalem': 1, 'tel aviv': 1, 'haifa': 1,
      'right to exist': 3, 'right to defend itself': 3, 'self-defense': 1, 'self defence': 1,
      'terrorist organization': 2, 'terror group': 2, 'terror groups': 2,
      'hamas': 1, 'hezbollah': 1, 'palestinian islamic jihad': 2, 'pij': 1,
      'rocket attacks': 2, 'rocket fire': 2, 'incendiary balloons': 2,
      'october 7': 1, 'oct 7': 1, 'simchat torah': 2, 'nova festival': 2,
      'tunnels': 1, 'terror tunnels': 3, 'attack tunnels': 3,
      'hostages': 1, 'abductees': 2,
      'iron dome': 1, 'david\'s sling': 2, 'arrow missile': 2,
      'mossad': 1, 'shin bet': 1, 'aman': 1,
      'settlers': 1, 'settler violence': 2,
      'two-state solution': 2, 'oslo accords': 2, 'camp david': 2,
      'right of return': 2,
      'western wall': 1, 'kosher': 1, 'jewish state': 2,
      'zionist': 1, 'zionism': 1, 'anti-zionist': 1, 'antisemitic': 1, 'anti-semitic': 1,
      'birthright': 1, 'aliyah': 1
    },
    atlanticist: {
      // Pro-NATO / transatlantic cues
      'nato': 1, 'nato alliance': 2, 'transatlantic': 3, 'trans-atlantic': 3,
      'us-eu': 1, 'us-european': 1, 'us european': 1,
      'article 5': 3, 'collective defense': 2, 'collective security': 2,
      'biden': 1, 'biden administration': 1, 'blinken': 1, 'austin': 1, 'sullivan': 1,
      'macron': 1, 'scholz': 1, 'sunak': 1, 'starmer': 1, 'meloni': 1, 'von der leyen': 1, 'stoltenberg': 1, 'rutte': 1,
      'european union': 1, 'eu': 1, 'european commission': 1, 'european council': 1,
      'g7': 2, 'g7 summit': 3, 'g20': 1,
      'five eyes': 2, 'aukus': 1,
      'washington': 1, 'brussels': 1, 'berlin': 1, 'paris': 1, 'london': 1, 'westminster': 1,
      'the west': 1, 'western': 1, 'western allies': 2, 'western partners': 2,
      'kremlin': 1, 'the kremlin': 1, 'moscow': 1, 'beijing': 1,
      'russian threat': 2, 'chinese threat': 2, 'iranian threat': 2,
      'rules-based international order': 3, 'rules based order': 3, 'liberal international order': 3,
      'free and open': 2, 'free and open indo-pacific': 3, 'indo-pacific': 2
    },
    statist: {
      // Pro-strong-state / anti-liberal cues
      'strong state': 3, 'state power': 2, 'state authority': 2,
      'order': 1, 'stability': 1, 'national unity': 2,
      'tradition': 1, 'traditional': 1, 'traditional values': 2, 'family values': 2,
      'authority': 1, 'strong leader': 2, 'strongman': 2,
      'sovereignty': 1, 'national sovereignty': 2,
      'law and order': 2, 'tough on crime': 3,
      'anti-corruption': 2, 'anti-corruption drive': 3,
      'centralized': 2, 'top-down': 2, 'command economy': 3,
      'nationalization': 3, 'nationalised': 2, 'nationalised industries': 3,
      'state capitalism': 3, 'state-owned': 2, 'state owned': 2, 'soe': 2,
      'putin': 1, 'xi': 1, 'xi jinping': 1, 'erdogan': 1, 'modi': 1, 'orbán': 1, 'lula': 1,
      'kremlin': 1, 'the kremlin': 1, 'beijing': 1, 'tehran': 1, 'ankara': 1
    },
    financialized: {
      // Pro-financialization / capital-markets cues
      'wall street': 1, 'markets': 1, 'stock market': 1, 'equity markets': 1,
      'investors': 1, 'investor confidence': 2, 'market confidence': 2,
      'hedge fund': 1, 'hedge funds': 1, 'private equity': 2, 'pe firms': 1, 'vulture fund': 3, 'vulture funds': 3,
      'shareholders': 1, 'shareholder value': 2,
      'quarterly earnings': 2, 'eps': 1, 'ebitda': 1,
      'merger': 1, 'acquisition': 1, 'm&a': 1, 'buyout': 1, 'leveraged buyout': 2, 'lbo': 1,
      'ipo': 1, 'secondary offering': 1, 'spac': 1,
      'fomc': 1, 'federal reserve': 1, 'the fed': 1, 'powell': 1, 'interest rate': 1, 'rate hike': 2, 'rate cut': 2, 'basis points': 1,
      'inflation': 1, 'cpi': 1, 'ppi': 1, 'gdp': 1, 'unemployment rate': 1,
      'yield curve': 1, 'bond yields': 1, 'treasuries': 1, 'corporate bonds': 1, 'junk bonds': 2,
      'dow': 1, 's&p 500': 1, 's&p': 1, 'nasdaq': 1, 'ftse': 1, 'dax': 1, 'nikkei': 1,
      'currency': 1, 'forex': 1, 'dollar': 1, 'euro': 1, 'yuan': 1, 'renminbi': 1, 'ruble': 1,
      'gold': 1, 'silver': 1, 'commodities': 1, 'crude': 1, 'brent': 1, 'wti': 1, 'opec': 1,
      'credit rating': 2, 'moody\'s': 1, 's&p global': 1, 'fitch': 1,
      'bis': 1, 'basel': 1, 'imf': 1, 'world bank': 1,
      'blackrock': 2, 'vanguard': 2, 'state street': 2, 'fidelity': 1, 'berkshire': 1, 'goldman sachs': 2, 'jpmorgan': 1, 'morgan stanley': 1, 'citi': 1, 'hsbc': 1, 'barclays': 1, 'deutsche bank': 1, 'ubs': 1, 'credit suisse': 1
    }
  };

  function _buildAxisRegex() {
    var compiled = {};
    Object.keys(AXIS_DICT).forEach(function(axis) {
      var words = Object.keys(AXIS_DICT[axis]);
      words.sort(function(a, b) { return b.length - a.length; });
      var pattern = words.map(function(w) {
        return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('|');
      compiled[axis] = new RegExp('\\b(' + pattern + ')\\b', 'gi');
    });
    return compiled;
  }
  var _axisRx = _buildAxisRegex();

  // Extract 5-axis frame from text. Returns 5 scores, one per axis.
  function _extractAxisFromText(text) {
    if (!text || typeof text !== 'string') {
      return { interventionist: 0, zionist: 0, atlanticist: 0, statist: 0, financialized: 0 };
    }
    var out = {};
    Object.keys(_axisRx).forEach(function(axis) {
      var rx = _axisRx[axis];
      var score = 0;
      rx.lastIndex = 0;
      var m;
      while ((m = rx.exec(text)) !== null) {
        var w = m[1].toLowerCase();
        score += (AXIS_DICT[axis][w] || 1);
      }
      out[axis] = score;
    });
    return out;
  }

  // ── PER-ARTICLE FACTUALITY HEURISTIC ──────────────────────────────────────
  // Score 0-100. Starts at 50 (neutral), modifiers add/subtract. Modifiers:
  //   +citations (+15)   — quoted sources ("said", "told", "according to")
  //   +named sources (+10) — proper-noun + person-title pattern ("Sen. X")
  //   +numbers (+5)       — specific numbers / dates / dollar amounts
  //   +attribution (+8)   — explicit attribution phrases
  //   +quotes (+5)        — direct quotation marks present
  //   +hedge (-3)         — strong hedging language ("allegedly", "reportedly")
  //   +sensational (-8)   — sensational/loaded words
  //   +opinion (-10)      — explicit first-person opinion markers
  //   +adverbs (-2 each)  — extreme adverbs ("very", "extremely", "shocking")
  //   +no-snippet (-25)   — empty snippet, can't evaluate
  // Capped 0-100. Tones: ≥70 = high, ≥45 = mixed, else = low.
  var ATTRIBUTION_RE = /\b(said|told|according to|stated|argued|noted|explained|claimed|added|warned|insisted|noted|spokesperson|spokesman|spokeswoman|representative|official|senator|rep\.|governor|president|secretary)\b/gi;
  var NUMBER_RE      = /\b(\$[\d,.]+|\d{1,3}(,\d{3})+|\d+\s?(percent|%|million|billion|trillion|thousand)|19\d{2}|20\d{2})\b/g;
  var QUOTE_RE       = /"[^"]{8,}"|"[^"]{8,}"|"[^"]+"/g;
  var HEDGE_RE       = /\b(allegedly|reportedly|supposedly|rumored|rumoured|claimed|unconfirmed|purported|apparent(ly)?|seemingly)\b/gi;
  var SENSATIONAL_RE = /\b(shocking|outrageous|explosive|devastating|horrifying|horrific|unprecedented|stunning|jaw-dropping|bombshell|explosive|sickening)\b/gi;
  var OPINION_RE     = /\b(I think|I believe|in my view|we must|you should|everyone should|obviously|clearly|the truth is|the fact is)\b/gi;
  var EXTREME_ADV_RE = /\b(very|extremely|incredibly|shockingly|absolutely|unquestionably|undeniably|devastatingly)\b/gi;
  var PROPER_NOUN_TITLE_RE = /\b(Sen\.|Rep\.|Gov\.|Pres\.|Sec\.|Gen\.|Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s+[A-Z][a-z]+/g;

  function _scoreArticleFactuality(article) {
    if (!article) return { score: 0, tone: 'low', signals: [] };
    var snippet = (article.snippet || '').trim();
    var headline = (article.headline || '').trim();
    var text = (headline + ' ' + snippet).trim();
    if (!text) return { score: 25, tone: 'low', signals: ['empty-snippet'] };

    var score = 50;
    var signals = [];

    if (ATTRIBUTION_RE.test(text))       { score += 15; signals.push('attribution'); }
    if (PROPER_NOUN_TITLE_RE.test(text)) { score += 10; signals.push('named-source'); }
    if (NUMBER_RE.test(text))            { score += 5;  signals.push('numbers'); }
    if (QUOTE_RE.test(text))             { score += 5;  signals.push('direct-quote'); }
    // Attribution + quote together (named attribution with a quote) is
    // the strongest signal — bonus.
    if (ATTRIBUTION_RE.test(text) && QUOTE_RE.test(text)) { score += 5; signals.push('attributed-quote'); }

    var hedges = (text.match(HEDGE_RE) || []).length;
    if (hedges > 0) { score -= Math.min(8, hedges * 3); signals.push('hedge-x' + hedges); }

    var sens = (text.match(SENSATIONAL_RE) || []).length;
    if (sens > 0) { score -= sens * 8; signals.push('sensational-x' + sens); }

    if (OPINION_RE.test(text)) { score -= 10; signals.push('opinion-marker'); }

    var advs = (text.match(EXTREME_ADV_RE) || []).length;
    if (advs > 0) { score -= Math.min(6, advs * 2); signals.push('extreme-adv-x' + advs); }

    if (score > 100) score = 100;
    if (score < 0)   score = 0;
    var tone = score >= 70 ? 'high' : score >= 45 ? 'mixed' : 'low';
    return { score: score, tone: tone, signals: signals };
  }

  // ── AGGREGATE PER-STORY (DOM) ────────────────────────────────────────────
  // Per-story roll-up: average article factuality across the article set,
  // and the dominant bloc + 5-axis direction. Returns:
  //   { avgFactuality, factTone, bloc, westernScore, nonAlignedScore,
  //     adversarialScore, axes, blocTally, articlesAnalyzed }
  // If a story has zero articles (slim payload only), the result is null.
  function _analyzeStoryArticles(story) {
    if (!story || !story.articles || !story.articles.length) return null;
    var articles = story.articles;
    var factTotal = 0, factCount = 0;
    var wTotal = 0, nTotal = 0, aTotal = 0;
    var axesTotals = { interventionist: 0, zionist: 0, atlanticist: 0, statist: 0, financialized: 0 };
    var tones = { high: 0, mixed: 0, low: 0 };
    var blocTally = { western: 0, 'non-aligned': 0, adversarial: 0, mixed: 0 };
    articles.forEach(function (a) {
      var f = _scoreArticleFactuality(a);
      var text = (a.headline || '') + ' ' + (a.snippet || '');
      var fr = _extractBlocFromText(text);
      var ax = _extractAxisFromText(text);
      factTotal += f.score;
      factCount += 1;
      tones[f.tone]++;
      wTotal += fr.westernScore;
      nTotal += fr.nonAlignedScore;
      aTotal += fr.adversarialScore;
      blocTally[fr.bloc]++;
      Object.keys(axesTotals).forEach(function(k) { axesTotals[k] += ax[k]; });
    });
    var avgFact = factCount ? Math.round(factTotal / factCount) : 0;
    var factTone = avgFact >= 70 ? 'high' : avgFact >= 45 ? 'mixed' : 'low';
    var totalBlocScore = wTotal + nTotal + aTotal;
    var bloc;
    if (totalBlocScore === 0) bloc = 'mixed';
    else {
      var scores = [['western', wTotal], ['non-aligned', nTotal], ['adversarial', aTotal]]
        .sort(function(a, b) { return b[1] - a[1]; });
      var dominanceMargin = scores[0][1] - scores[1][1];
      bloc = dominanceMargin < 2 ? 'mixed' : scores[0][0];
    }
    return {
      avgFactuality: avgFact,
      factTone: factTone,
      bloc: bloc,
      westernScore: wTotal,
      nonAlignedScore: nTotal,
      adversarialScore: aTotal,
      axes: axesTotals,
      blocTally: blocTally,
      tones: tones,
      articlesAnalyzed: factCount
    };
  }

  // Public API
  window.BWB_ARTICLE_ANALYZER = {
    extractBloc: _extractBlocFromText,
    extractAxis: _extractAxisFromText,
    scoreFactuality: _scoreArticleFactuality,
    analyzeStory: _analyzeStoryArticles
  };
})();
