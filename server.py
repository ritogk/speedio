from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/api/winding")
def get_winding():
    current_latitude = request.args.get('current_latitude')
    current_longitude = request.args.get('current_longitude')
    destination = request.args.get('destination')

    if current_latitude is None or current_longitude is None or destination is None:
        error_message = "Both 'current_location' and 'destination_name' are required."
        return jsonify({'error': error_message}), 400
    return ['ok']