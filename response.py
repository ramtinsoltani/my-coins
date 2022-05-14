def success_when(value, expect):
    '''
    Returns a success response determined by comparing the value and the expectation.
        Parameters:
            value: The value to check
            expect: The expectation of the value
        Returns:
            response (dict): A response object
    '''
    return { 'success': value == expect }

INVALID_RESPONSE = { 'invalid': True }
ERROR_RESPONSE = { 'error': True }
JSON_CONTENT_TYPE_HEADER = { 'Content-Type': 'application/json; charset=utf-8' }
