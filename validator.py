from bson.objectid import ObjectId

def validate_id(id):
    '''
    Checks to see if the given id is a valid MongoDb ObjectId.
        Parameters:
            id (str): The id to check
        Returns:
            result (bool): The validation result
    '''
    # Use MongoDb's ObjectId validator function to validate the id
    return ObjectId.is_valid(id)

def validate_body(body, validator, strict=False):
    '''
    Validates a request body against the given validator.
        Parameters:
            body (dict): The request body
            validator (dict): A validation schema
            strict (bool): Optional, indicates if the body should have all keys defined in the validation schema or not
        Returns:
            result (bool): The validation result
    '''
    # Invalid if body is not a dictionary/object
    if type(body) is not dict: return False
    # Iterate through validator keys
    for key in validator:
        # Invalid if strict checking and validator key does not exist in body
        if strict and not key in body: return False
        # Invalid if validator key is found in body but value has a different type than validator's value
        if key in body and type(body[key]) is not validator[key]: return False
    # Iterate through body keys
    for key in body:
        # Invalid if body key does not exist in validator
        if not key in validator: return False
    # Valid if all the above checks have been passed
    return True
