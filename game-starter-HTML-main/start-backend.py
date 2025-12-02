from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import re

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

# In-memory starter state (for new games)
@app.route('/start', methods=['GET'])
def start_page():
    return render_template('start.html')

@app.route('/api/start', methods=['POST'])
def start_game():
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()
    if not name or not re.search(r'[A-Za-z]', name):
        return jsonify({'ok': False, 'error': 'Enter a valid name (letters required).'}), 400

    state = {
        'playerName': name,
        'credits': 1000,
        'energy': 1000,
        'shards': {f'shard{i}': False for i in range(1,6)},
        'countShards': 0,
        'currentLocation': 'EFHK'
    }

    return jsonify({'ok': True, 'state': state})

if __name__ == '__main__':
    app.run(port=5000, debug=True)