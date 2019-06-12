# BioWardrobe NG
[![Build Status](https://travis-ci.org/Barski-lab/biowardrobe-ng.svg?branch=master)](https://travis-ci.org/Barski-lab/biowardrobe-ng)


## Download/Copy files based on the protocol

1. Read `Aria2` configuration from `download["aria2"]` field of `settings.json` configuration file. If absent, `Aria2` and therefore any download/copy mechanism won't be used. Set additional security options if necessary.

   ```yaml
      "download": {
        "aria2": {
          "host": "localhost",
          "port": 6800,
          "secure": false,
          "secret": "your secret token",
          "path": "/jsonrpc"
        }
      }
    ```

2. Run `Aria2` server following the example. Set additional security options if necessary.

   ```bash
      aria2c --enable-rpc --rpc-listen-all=false --auto-file-renaming=false --rpc-listen-port=6800 --console-log-level=debug --rpc-secret="your secret token"
   ```

3. To attach file from directory on the satellite the input should look the following way
   ```yaml
        "fastq_file": {
            "class": "File",
            "location": "files:///input.fastq.gz",
            "token": "token://cd62d3d9587e44d9a537c1444c903b59"
        },
   ```
   Decoded token should have at least three mandatory fields: `projectId`, `userId`, `fileId`.
   Make sure to set protocol to `files` for the remote module to process the copying from the local directory (in `settings.json`).