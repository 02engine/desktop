from huggingface_hub import HfApi
import json
import os
import requests

print('Starting script...')
api = HfApi()
repo_id = '02engine/02engine_release'  # 组织存储库
repo_type = 'dataset'  # 设置为 dataset
token = os.getenv('HF_TOKEN')
if not token:
    raise ValueError('HF_TOKEN is not set')
print(f'Repo ID: {repo_id}')
print(f'Repo Type: {repo_type}')
print('Token: ' + ('Set' if token else 'Not set'))

# 读取所有 Release
try:
    with open('releases.json') as f:
        releases = json.load(f)
    print('Successfully loaded releases.json')
except Exception as e:
    print(f'Error loading releases.json: {e}')
    raise

# 检查存储库文件
try:
    print(f'Checking repo: {repo_id} ({repo_type})')
    existing_files = api.list_repo_files(repo_id=repo_id, repo_type=repo_type, token=token)
    print(f'Fetched {len(existing_files)} existing files from Hugging Face')
except Exception as e:
    print(f'API Error: {e}')
    raise

for release in releases:
    tag_name = release['tag_name']
    os.makedirs(tag_name, exist_ok=True)
    for asset in release['assets']:
        asset_name = asset['name']
        asset_path = os.path.join(tag_name, asset_name)
        repo_path = tag_name + '/' + asset_name
        if repo_path not in existing_files:
            print('Downloading ' + asset_name + ' for tag ' + tag_name)
            try:
                with open(asset_path, 'wb') as f:
                    f.write(requests.get(asset['browser_download_url']).content)
                print('Uploading ' + asset_path + ' to ' + repo_path)
                api.upload_file(
                    path_or_fileobj=asset_path,
                    path_in_repo=repo_path,
                    repo_id=repo_id,
                    repo_type=repo_type,
                    token=token
                )
            except Exception as e:
                print(f'Error processing {asset_name}: {e}')
                raise
        else:
            print('Skipping ' + repo_path + ', already exists')
