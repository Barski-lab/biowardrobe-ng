# BioWardrobe NG
[![Build Status](https://travis-ci.org/Barski-lab/biowardrobe-ng.svg?branch=master)](https://travis-ci.org/Barski-lab/biowardrobe-ng)


## Download/Copy files based on the protocol

1. Add `Aria2` configuration to the `settings.json` configuration file. If absent, `Aria2` and therefore any download/copy mechanism won't be used. Set additional security options if necessary.

   ```yaml
      "download": {
        "aria2": {
          "host": "localhost",
          "port": 6800,
          "secure": false,
          "secret": "secret_key",
          "path": "/jsonrpc"
        }
      }
    ```

2. Add new remote to the `remotes` section of the `settings.json` configuration file for processing direct links to the input files

   ```yaml
      "directurl": {
        "caption": "Direct URL",
        "type": "files",
        "protocol": ["https"],          # can be String also
        "refreshSessionInterval": 180
      }
   ```

3. Run `Aria2` server following the example. Set additional security options if necessary.

   ```bash
      aria2c --enable-rpc --rpc-listen-all=false --auto-file-renaming=false --rpc-listen-port=6800 --console-log-level=debug --rpc-secret="secret_key"
   ```

4. Input should look the following way
   ```yaml
        "fastq_file": {
            "class": "File",
            "location": "PROTOCOL:///input.fastq.gz",             # PROTOCOL defines the remote module to use
            "token": "token://cd62d3d9587e44d9a537c1444c903b59"
        },
   ```

   Decoded token should have at least three mandatory fields: `projectId`, `userId`, `fileId`.
   Make sure to set protocol to `files` for the remote module to process the copying from the local directory (in `settings.json`).