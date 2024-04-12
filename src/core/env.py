from dotenv import load_dotenv
import os


load_dotenv()


def getEnv():
    POINT_ST = os.getenv("POINT_ST")
    POINT_ED = os.getenv("POINT_ED")
    CONSIDER_GSI_WIDTH = os.getenv("CONSIDER_GSI_WIDTH")
    return {
        "POINT_ST": POINT_ST.replace(" ", "").split(","),
        "POINT_ED": POINT_ED.replace(" ", "").split(","),
        "CONSIDER_GSI_WIDTH": True if CONSIDER_GSI_WIDTH == "1" else False,
    }
