import logging
import sys
from datetime import datetime
from datetime import timezone

import requests

logging.basicConfig()
logger = logging.getLogger(__name__)
logger.setLevel("INFO")


class OpenDataAPI:
    def __init__(self, api_token: str):
        self.base_url = "https://api.dataplatform.knmi.nl/open-data/v1"
        self.headers = {"Authorization": api_token}

    def __get_data(self, url, params=None):
        return requests.get(url, headers=self.headers, params=params).json()

    def list_files(self, dataset_name: str, dataset_version: str, params: dict):
        return self.__get_data(
            f"{self.base_url}/datasets/{dataset_name}/versions/{dataset_version}/files",
            params=params,
        )

    def get_file_url(self, dataset_name: str, dataset_version: str, file_name: str):
        return self.__get_data(
            f"{self.base_url}/datasets/{dataset_name}/versions/{dataset_version}/files/{file_name}/url"
        )


def download_file_from_temporary_download_url(download_url, filename):
    try:
        with requests.get(download_url, stream=True) as r:
            r.raise_for_status()
            with open(filename, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
    except Exception:
        logger.exception("Unable to download file using download URL")
        sys.exit(1)

    logger.info(f"Successfully downloaded dataset file to {filename}")


def main():
    api_key = "eyJvcmciOiI1ZTU1NGUxOTI3NGE5NjAwMDEyYTNlYjEiLCJpZCI6IjdhZTJlZDc4YTBhYTQ3Mzk5MTFkM2NkYzgzYzVmMWI1IiwiaCI6Im11cm11cjEyOCJ9"
    dataset_name = "Actuele10mindataKNMIstations"
    dataset_version = "2"

    api = OpenDataAPI(api_token=api_key)

    timestamp = datetime.now(timezone.utc).date().strftime("%Y-%m-%dT%H:%M:%S+00:00")
    logger.info(f"Fetching first file of {dataset_name} version {dataset_version} on {timestamp}")

    # order the files by creation date and begin listing after the specified timestamp
    params = {"orderBy": "created", "begin": timestamp}
    response = api.list_files(dataset_name, dataset_version, params)
    if "error" in response:
        logger.error(f"Unable to retrieve list of files: {response['error']}")
        sys.exit(1)

    file_name = response["files"][0].get("filename")
    logger.info(f"First file of {timestamp} is: {file_name}")

    # fetch the download url and download the file
    response = api.get_file_url(dataset_name, dataset_version, file_name)
    download_file_from_temporary_download_url(response["temporaryDownloadUrl"], file_name)


if __name__ == "__main__":
    main()
