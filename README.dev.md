# BioWardrobe NG

## BioWardrobe-NG startup routine

1. Read `biowardrobe` object from `settings.json` to establish connection with BioWardrobe DB

   ```yaml
     "biowardrobe": {
       "db": {
         "host":     String,
         "user":     String,
         "password": String,
         "database": "ems",
         "port":     Int
       }
     }
    ```
2. Check if `settings.json` includes information required for connection with the Central Post

   ```yaml
      "rc_server": String,
      "rc_server_token": String
   ```

2.1 **YES:** connection to the Central Post can be established

- Run syncronization with the Central Post

2.2 **NO:** Connection to the Central Post can't be established

- Fetch workflows from GitHub
    - Read GitHub configuration from the `settings.json`

      ```yaml
        "git": {
          "path":         String,  # Absolute path to the cloned repository
          "url":          String,  # URL to remote
          "branch":       String,  # Branch to work with
          "workflowsDir": String   # Relative path to the folder with workflows (relative to the repository's root)
        }
        ```
    - Try to clone repository from `git.url`
    - If clonning failed, open local repository from `git.path`
    - Fetch changes from the remote `origin` (currently harcoded [here](https://github.com/Barski-lab/biowardrobe-ng/blob/6fa9ab80999ee5920d2c275e30827d07e3281307/imports/server/methods/git.ts#L17))
    - Merge fetched changes into `git.branch`
    - Get latest commit from `git.branch`
    - Get file list from `git.workflowsDir`
    - For each workflow file:
        - Pack workflow and all dependencies into a single file
        - Upsert document in `CWL` collection (update if the document with the relative path the the workflow file and remote URL from where it was fetched already exist in the collection)
        - Read `airflow` object from `settings.json`
        ```yaml
          "airflow":{
            "dagFolder": String  # From this folder Airflow loads DAGs
          }
        ```
        - Export `*.cwl` and correspondent `*.py` file into `airflow.dagFolder`

## BioWardrobe-NG invoice generation

1. Read `billing` configuration from `settings.json` to allow invoice generation (if absent - skip invoice generation)

   ```yaml
      "billing":{
        "organization": "",
        "businessUnit": "",
        "fund": "",
        "department": "",
        "account": ""
      }
   ```

## BioWardrobe-NG Aria2

1. Read `Aria2` configuration from `download["aria2"]` field of `settings.json` configuration file. If absent, `Aria2` won't be used. Set additional security options if necessary.

   ```yaml
      "download": {
        "aria2": {
          "host": "localhost",
          "port": 6800,
          "secure": false,
          "secret": "",
          "path": "/jsonrpc"
        }
      }
    ```

2. Run `Aria2` server following the example. Set additional security options if necessary.

   ```bash
      aria2c --enable-rpc --rpc-listen-all=false --auto-file-renaming=false --rpc-listen-port=6800
   ```
