from flask import Flask, request, send_from_directory, jsonify
from werkzeug.exceptions import HTTPException
import mongod
from response import *
from validator import *
import bittrex

app = Flask(__name__)

################################################################
######################## API ENDPOINTS #########################
################################################################

@app.route('/purchases', methods=['GET'])
def get_purchases():
    # Read all documents under the purchases collection
    return jsonify(mongod.read_all_documents('purchases')), JSON_CONTENT_TYPE_HEADER

@app.route('/purchase/<id>', methods=['DELETE'])
def delete_purchase(id):
    # Validate id
    if not validate_id(id): return INVALID_RESPONSE, 400
    # Delete document with id
    result = mongod.delete_document('purchases', id)
    return success_when(result, True), JSON_CONTENT_TYPE_HEADER

@app.route('/purchase/<id>', methods=['PUT'])
def update_purchase(id):
    # Validate id
    if not validate_id(id): return INVALID_RESPONSE, 400
    # Validate body
    if not validate_body(request.json, mongod.DOCUMENT_SCHEMA):
        return INVALID_RESPONSE, 400
    # Update document with id
    result = mongod.update_document('purchases', id, request.json)
    return success_when(result, True), JSON_CONTENT_TYPE_HEADER

@app.route('/purchase', methods=['POST'])
def add_new_purchase():
    # Validate body
    if not validate_body(request.json, mongod.DOCUMENT_SCHEMA, True):
        return INVALID_RESPONSE, 400
    # Create new document
    return mongod.create_document('purchases', request.json), JSON_CONTENT_TYPE_HEADER

@app.route('/bitcoin', methods=['GET'])
def get_bitcoin_price():
    # Get current bitcoin price/ticker from Bittrex API
    result = bittrex.get_bitcoin_ticker()
    return result[1], result[0], JSON_CONTENT_TYPE_HEADER

################################################################
######################## STATIC HOSTING ########################
################################################################

@app.route('/', methods=['GET'])
def static_hosting_for_root():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>', methods=['GET'])
def static_hosting_for_files(path):
    return send_from_directory('public', path)

################################################################
######################## ERROR HANDLER #########################
################################################################

@app.errorhandler(Exception)
def handle_exception(e):
    # HTTP exceptions
    if isinstance(e, HTTPException):
        return e
    # non-HTTP exceptions
    print(e)
    return ERROR_RESPONSE, 500, JSON_CONTENT_TYPE_HEADER
