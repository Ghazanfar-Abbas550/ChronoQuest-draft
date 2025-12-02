from flask import Flask, render_template, jsonify, request
import json
import os
import random

app = Flask(__name__, template_folder="templates", static_folder="static")

DATA_FILE = os.path.join(os.path.dirname(__file__), "airport-data.json")
with open(DATA_FILE, 'r', encoding='utf-8') as f:
    AIRPORTS = json.load(f)

# Server-side canonical state (in memory)
GAME_STATE = {
    'playerName': '',
    'credits': 1000,
    'energy': 1000,
    'shards': {f'shard{i}': False for i in range(1,6)},
    'countShards': 0,
    'currentLocation': 'EFHK'
}

@app.route('/main')
def main_page():
    return render_template('main.html')

@app.route('/api/main/airports', methods=['GET'])
def get_airports():
    return jsonify(AIRPORTS)

@app.route('/api/main/state', methods=['GET'])
def get_state():
    return jsonify({'state': GAME_STATE})

@app.route('/api/main/update', methods=['POST'])
def update_state():
    data = request.get_json() or {}
    if 'state' in data:
        state = data['state']
        for k,v in state.items():
            GAME_STATE[k] = v
        GAME_STATE['countShards'] = sum(1 for v in GAME_STATE['shards'].values() if v)
    return jsonify({'state': GAME_STATE})

@app.route('/api/main/travel', methods=['POST'])
def travel():
    data = request.get_json() or {}
    icao = data.get('ICAO')
    airport = next((a for a in AIRPORTS if a.get('ICAO') == icao), None)
    if not airport:
        return jsonify({'events': [], 'state': GAME_STATE})

    events = []
    win = False
    lose = False

    # choose energy cost randomly 20-200
    energy_cost = random.randint(20,200)

    if GAME_STATE['energy'] < energy_cost:
        events.append({'type':'not_enough_energy', 'required': energy_cost})
        # Check if player has no way to continue -> automatic lose
        if GAME_STATE['credits'] <= 0:
            events.append({'type':'lose'})
            lose = True
        return jsonify({'events': events, 'state': GAME_STATE, 'win': win, 'lose': lose})

    GAME_STATE['energy'] = max(0, GAME_STATE['energy'] - energy_cost)
    GAME_STATE['currentLocation'] = airport['ICAO']

    # random shard awarding (server chooses shard number)
    remaining = [i for i in range(1,6) if not GAME_STATE['shards'][f'shard{i}']]
    if remaining and random.random() < 0.5:
        s = random.choice(remaining)
        GAME_STATE['shards'][f'shard{s}'] = True
        GAME_STATE['countShards'] = sum(1 for v in GAME_STATE['shards'].values() if v)
        events.append({'type':'shard', 'shard': s})  # numeric shard id

    # bandits
    if random.random() < 0.1:
        loss = random.randint(20,150)
        GAME_STATE['credits'] = max(0, GAME_STATE['credits'] - loss)
        events.append({'type':'bandit', 'amount': loss})

    # credit gain
    gain = random.randint(0,100)
    if gain>0:
        GAME_STATE['credits'] += gain
        events.append({'type':'credit', 'amount': gain})

    # check for win
    if GAME_STATE['countShards'] >= 5 and airport['ICAO'] == 'EFHK':
        events.append({'type':'win'})
        win = True
    else:
        # automatic lose if player cannot make any travel and hasn't all shards
        # 1. No credits AND 2. Not enough energy for minimal flight (20)
        if GAME_STATE['countShards'] < 5 and GAME_STATE['credits'] <= 0 and GAME_STATE['energy'] < 20:
            events.append({'type':'lose'})
            lose = True

    return jsonify({'events': events, 'state': GAME_STATE, 'win': win, 'lose': lose})

if __name__ == '__main__':
    app.run(port=5001, debug=True)