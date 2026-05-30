from http import HTTPStatus

def handler(request):
    return {"statusCode": HTTPStatus.OK, "body": "pong"}
