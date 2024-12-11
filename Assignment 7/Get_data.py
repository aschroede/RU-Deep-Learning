import requests
import json

# Set the URL and API key
url = "https://api.dataplatform.knmi.nl/open-data/v1/datasets/radar_reflectivity_composites/versions/2.0/files"
headers = {
    "Authorization": "eyJvcmciOiI1ZTU1NGUxOTI3NGE5NjAwMDEyYTNlYjEiLCJpZCI6IjdhZTJlZDc4YTBhYTQ3Mzk5MTFkM2NkYzgzYzVmMWI1IiwiaCI6Im11cm11cjEyOCJ9"  # Replace YOUR_API_KEY with your actual key
}

# Make the request to fetch data
response = requests.get(url, headers=headers)

if response.status_code == 200:
    data = response.json()  # Get the JSON data


    # Save the portion to a file
    with open("portion_of_knmi_data.json", "w") as file:
        json.dump(data, file, indent=4)

    print("Data saved to 'portion_of_knmi_data.json'")
else:
    print(f"Error: {response.status_code}")
