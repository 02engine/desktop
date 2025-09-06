from huggingface_hub import HfApi
import json
import os
import requests

prin("贝利亚！")
print('Starting script...')
api = HfApi()
repo_id = '02engine/02engine_release'  # 替换为实际值
token = os.getenv('HF_TOKEN')
if not token:
    raise ValueError('HF_TOKEN is not set')
print(f'Repo ID: {repo_id}')
print(f'Token: {"Set" if token else "Not set"}')

# 读取所有 Release
with open('releases.json') as f:
    releases = json.load(f)

# 获取现有 Hugging Face 文件
try:
    existing_files = api.list_repo_files(repo_id=repo_id, repo_type='model', token=token)
    print('Fetched existing files from Hugging Face')
except Exception as e:
    print(f'API Error: {e}')
    raise

for release in releases:
    tag_name = release['tag_name']
    os.makedirs(tag_name, exist_ok=True)
    for asset in release['assets']:
        asset_name = asset['name']
        asset_path = os.path.join(tag_name, asset_name)
        repo_path = f'{tag_name}/{asset_name}'
        if repo_path not in existing_files:
            print(f'Downloading {asset_name} for tag {tag_name}')
            with open(asset_path, 'wb') as f:
                f.write(requests.get(asset['browser_download_url']).content)
            print(f'Uploading {asset_path} to {repo_path}')
            api.upload_file(
                path_or_fileobj=asset_path,
                path_in_repo=repo_path,
                repo_id=repo_id,
                repo_type='dataset',
                token=token
            )
        else:
            print(f'Skipping {repo_path}, already exists')
