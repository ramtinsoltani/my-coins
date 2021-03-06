from pymongo import MongoClient, DESCENDING
from bson.objectid import ObjectId
import utilities as utils

################################################################
######################### PRIVATE API ##########################
################################################################

# Connect to MongoDb
_client = MongoClient('localhost', 27017)
# Keep reference to the desired database instance
_db = _client.ashkan

def _to_json(document):
    '''
    Converts a MongoDb document reference to JSON
        Parameters:
            document (document): A MongoDb reference
        Returns:
            document (dict): The JSON version of the document
    '''
    # Convert document's ObjectId to string
    document['_id'] = str(document['_id'])
    return document

def _read_document(collection, id):
    '''
    Returns a document by id
        Parameters:
            collection (str): The collection name
            id (str): The document id
        Returns:
            document (dict): The document data
    '''
    return _to_json(_db[collection].find_one({ '_id': id }))

################################################################
########################## PUBLIC API ##########################
################################################################

# Document schema used for input validation
DOCUMENT_SCHEMA = {
    'dollar_value': [float, int],
    'euro_value': [float, int],
    'coin_price': [float, int],
    'coin_volume': [float, int],
    'market': [str],
    'created_at': [int]
}

def get_markets(collection):
    '''
    Returns the list of bittrex markets from all purchases
        Parameters:
            collection (str): The collection name
        Returns:
            markets (list): The list of bittrex markets
    '''
    # Find distinct values of property 'market' from all documents
    markets = _db[collection].distinct('market')
    # Sort markets
    markets.sort()
    return markets

def create_document(collection, data):
    '''
    Creates a new document in a collection
        Parameters:
            collection (str): The collection name
            data (dict): The data to write
        Returns:
            document (dict): The written document data
    '''
    # Insert new document and read its id
    id = _db[collection].insert_one(data).inserted_id
    # Read the document by id and return its data
    return _read_document(collection, id)

def read_all_documents(collection, market):
    '''
    Reads all documents in a collection
        Parameters:
            collection (str): The collection name
            market (str): The market name
        Returns:
            documents (list<object>): A list of all the documents
    '''
    documents = []
    # Iterate through the collection, sorted by creation time in descending order
    for document in _db[collection].find({ 'market': market }).sort([('created_at', DESCENDING)]):
        # Convert the document to JSON and add to list
        documents.append(_to_json(document))
    return documents

def delete_document(collection, id):
    '''
    Deletes a document in a collection
        Parameters:
            collection (str): The collection name
            id (str): The document id
        Returns:
            result (bool): The result of the deletion
    '''
    # Find the document by id and delete, read deletion count
    deletions = _db[collection].delete_one({ '_id': ObjectId(id) }).deleted_count
    # Return true if one document has been deleted
    return deletions == 1

def update_document(collection, id, data):
    '''
    Updates a document in a collection
        Parameters:
            collection (str): The collection name
            id (str): The document id
            data (dict): The update data to apply to the document
        Returns:
            result (bool): The result of the update
    '''
    # Find the document by id and update with new data, read modified count
    updates = _db[collection].update_one({ '_id': ObjectId(id) }, { '$set': data }).modified_count
    # Return true if one document has been modified
    return updates == 1
