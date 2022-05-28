import utilities as utils
from requests import request
from json import dumps as stringify
from hashlib import sha512
import hmac

################################################################
######################### PRIVATE API ##########################
################################################################

_BASE_URL = 'https://api.bittrex.com/v3'
_API_KEY = utils.get_env_var('BITTREX_API_KEY')
_API_SECRET = utils.get_env_var('BITTREX_API_SECRET')

def _get_sha512_hash(text):
    '''
    Returns the SHA512 hash of the given text in hex.
        Parameters:
            text (str): A string to get the hash for
        Returns:
            hash (str): The SHA512 hash
    '''
    # Convert text to bytes and calculate the SHA512 hash
    return sha512(text.encode()).hexdigest()

def _get_hmac_sha512(text):
    '''
    Returns the HMAC_SHA512 hash of the given text in hex.
        Parameters:
            text (str): A string to get the hash for
        Returns:
            hash (str): The HMAC_SHA512 hash
    '''
    # Convert text to bytes and calculate the HMAC_SHA512 hash
    return hmac.new(_API_SECRET.encode(), text.encode(), sha512).hexdigest()

def _get_bittrex_headers(method, full_url, body=None):
    '''
    Generates the Bittrex headers needed for correct authentication.
        Parameters:
            method (str): The HTTP method of the request in uppercase
            full_url (str): The full URL of the request including query strings
            body (dict): Optional, the body of the request
        Returns:
            headers (dict): The headers object with the required fields
    '''
    # Get current timestamp as string
    timestamp = str(utils.get_timestamp())
    # Calculate the content hash based on body (use empty string if no body was given, otherwise stringify
    # the body with unnecessary spaces omitted)
    content_hash = _get_sha512_hash(stringify(body, separators=(',', ':')) if body is not None else '')
    # Create the pre-signature string
    pre_sign = f'{timestamp}{full_url}{method}{content_hash}'
    # Generate the request signature (HMAC_SHA512 hash of the pre-signature string)
    signature = _get_hmac_sha512(pre_sign)
    # Return everything as a headers dictionary/object
    return {
        'Api-Key': _API_KEY,
        'Api-Timestamp': timestamp,
        'Api-Content-Hash': content_hash,
        'Api-Signature': signature
    }

################################################################
########################## PUBLIC API ##########################
################################################################

def get_bittrex_market_ticker(market):
    '''
    Sends an authorized request to Bittrex API to get the current market ticker for the given market.
        Params:
            market (str): The market name (e.g. BTC-USD)
        Returns:
            result (tuple): A tuple with the status code and the response body
    '''
    # Prepare request requirements
    method = 'GET'
    full_url = _BASE_URL + '/markets/' + market + '/ticker'
    headers = _get_bittrex_headers(method, full_url)
    # Send the request
    res = request(method, url=full_url, headers=headers)
    # Return status code and response body as tuple
    return (res.status_code, res.content)

def get_markets():
    '''
    Gets a list of all markets from Bittrex API.
        Returns:
            markets (list): A list of all markets
    '''
    method = 'GET'
    full_url = _BASE_URL + '/markets'
    headers = _get_bittrex_headers(method, full_url)
    # Send the request
    res = request(method, url=full_url, headers=headers)
    # If response status is not OK 200
    if res.status_code != 200:
        # Return status code and response body as tuple
        return (res.status_code, res.content)
    else:
        # Extract markets from response
        markets = []
        for market in res.json():
            markets.append(market['symbol'])
        # Return status code and markets list as tuple
        return (res.status_code, markets)