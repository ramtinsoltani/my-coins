from time import time
from os import getenv

def get_timestamp():
    '''
    Returns the current timestamp in ms format.
        Returns:
            timestamp (int): The current timestamp in ms format
    '''
    # Return a timestamp in milliseconds integer format
    return int(round(time() * 1000))

def get_env_var(name):
    '''
    Returns an environment variable value while checking for its existance (throws error).
        Paramaters:
            name (str): The environment variable name
        Returns:
            value (str): The environment variable value
    '''
    # Read environment variable
    value = getenv(name)
    # If variable is not set, raise an exception
    if not value: raise Exception(f'Missing environment variable {name}')
    # Otherwise, return the environment variable value
    return value
