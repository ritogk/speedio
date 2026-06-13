import json


def write(obj, path: str):
    with open(path, "w") as file:
        json.dump(obj, file, indent=4)
