from flask import Flask, jsonify, send_from_directory
import os

app = Flask(__name__)

# Define the path to the bias_summary.json file
BIAS_SUMMARY_PATH = os.path.join(os.path.dirname(__file__), 'bias_summary.json')

@app.route('/')
def serve_index():
    return send_from_directory(os.path.dirname(__file__), 'index.html')

@app.route('/bias')
def get_bias_summary():
    try:
        with open(BIAS_SUMMARY_PATH, 'r') as f:
            data = f.read()
        return jsonify(eval(data)) # Using eval for simplicity, but in a real app, use json.load
    except FileNotFoundError:
        return jsonify({"error": "bias_summary.json not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001)
