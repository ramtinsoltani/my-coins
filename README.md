# My Coins API Server

#### How to run
  1. Install all the dependencies: `pip install -r requirements.txt`
  2. Set the environment variables `BITTREX_API_KEY` and `BITTREX_API_SECRET` with your Bittrex account API key and secret
  3. Run `flask run`
  4. API server becomes available on `http://localhost:5000`

#### Endpoints:
  - **GET** `/purchases`: Returns a list of all purchases
    - **Response**: Array of [Detailed Purchase](#detailed-purchase) or [Error](#error)
  - **POST** `/purchase`: Creates a new purchase in the database
    - **Body**: [Purchase](#purchase)
    - **Response**: [Detailed Purchase](#detailed-purchase) or [Invalid](#invalid) or [Error](#error)
  - **PUT** `/purchase/<id>`: Updates an existing purchase in the database
    - **Parameters**:
      - **id**: The ID of the purchase to update
    - **Body**: [Purchase](#purchase)
    - **Response**: [Success](#success) or [Invalid](#invalid) or [Error](#error)
  - **DELETE** `/purchase/<id>`: Deletes a purchase from the database
    - **Parameters**:
      - **id**: The ID of the purchase to update
    - **Response**: [Success](#success) or [Invalid](#invalid) or [Error](#error)
  - **GET** `/bitcoin`: Returns the current market ticker for BTC-USD from Bittrex
    - **Response**: [Bittrex Ticker](#bittrex-ticker) or [Bittrex Error](#bittrex-error) or [Error](#error)

#### Static hosting

Contents of `/public` directory is hosted on `http://localhost:5000`.

# Responses

The following responses are defined in the API server's REST interface:

## Purchase

```py
{
    # The dollars value of the purchase
    'dollar_value': float,
    # The euros value of the purchase
    'euro_value': float,
    # The Bitcoin price at the time of the purchase
    'bitcoin_price': float,
    # The Bitcoin volume purchased
    'bitcoin_volume': float,
    # An epoch timestamp (in milliseconds) for the date of purchase
    'created_at': int
}
```

## Detailed Purchase

```py
{
    '_id': str,
    # The dollars value of the purchase
    'dollar_value': float,
    # The euros value of the purchase
    'euro_value': float,
    # The Bitcoin price at the time of the purchase
    'bitcoin_price': float,
    # The Bitcoin volume purchased
    'bitcoin_volume': float
    # An epoch timestamp (in milliseconds) for the date of purchase
    'created_at': int
}
```

## Success

```py
{
    'success': True
}
```

## Invalid

```py
{
    'invalid': True
}
```

## Error

```py
{
    'error': True
}
```

## Bittrex Ticker

```py
{
    'symbol': str,
    'lastTradeRate': float,
    'bidRate': float,
    'askRate': float
}
```

## Bittrex Error

```py
{
    'code': str,
    # Optional
    'detail': str,
    # Optional
    'data': dict
}
```
