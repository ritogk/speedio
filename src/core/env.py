from dotenv import load_dotenv
import os


load_dotenv()


def getEnv():
    USE_CUSTOM_AREA = os.getenv("USE_CUSTOM_AREA")
    CUSTOM_AREA_POINT_ST = os.getenv("CUSTOM_AREA_POINT_ST")
    CUSTOM_AREA_POINT_ED = os.getenv("CUSTOM_AREA_POINT_ED")
    AREA_PREFECTURE_NAME = os.getenv("AREA_PREFECTURE_NAME")
    CONSIDER_GSI_WIDTH = os.getenv("CONSIDER_GSI_WIDTH")
    SHOW_CORNER = os.getenv("SHOW_CORNER")
    return {
        "USE_CUSTOM_AREA": True if USE_CUSTOM_AREA == "1" else False,
        "CUSTOM_AREA_POINT_ST": CUSTOM_AREA_POINT_ST.replace(" ", "").split(","),
        "CUSTOM_AREA_POINT_ED": CUSTOM_AREA_POINT_ED.replace(" ", "").split(","),
        "AREA_PREFECTURE_NAME": AREA_PREFECTURE_NAME,
        "CONSIDER_GSI_WIDTH": True if CONSIDER_GSI_WIDTH == "1" else False,
        "SHOW_CORNER": True if SHOW_CORNER == "1" else False,
    }
