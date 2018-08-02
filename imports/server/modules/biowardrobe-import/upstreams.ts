export const bowtie_idx = [
    {
        "_id": "xEsr3hHKfLRbXi39K",
        "date": {
            "created": "2012-09-06T18:21:52.362Z"
        },
        "projectId": "Mrx3c92PKkipTBMsA",
        "preview": {
            "line1": "Homo sapiens (hg19)",
            "line2": "Genome Reference Consortium Human Build 37 (GRCh37)/(hg19) 2009/02/27",
            "line3": "https://www.ncbi.nlm.nih.gov/assembly/GCF_000001405.13/"
        },
        "result_preview": {

        },
        "cwl": {
            "cwlId": "3PfggtmrE3FBdrPcy",
            "input": {
                "genome": "Human genome (hg19)",
                "fasta_input_file": {
                    "class": "File",
                    "location": "file:///wardrobe/indices/bowtie/hg19.fa",
                    "format": "http://edamontology.org/format_1929"
                }
            },
            "output": {
                "indices_folder": {
                    "class": "Directory",
                    "location": "file:///wardrobe/indices/bowtie/hg19",
                    "basename": "hg19"
                },
                "annotation_file": {
                    "class": "File",
                    "location": "file:///wardrobe/indices/annotations/hg19/refgene.tsv",
                    "format": "http://edamontology.org/format_3475",
                    "size": 11695998,
                    "basename": "refgene.tsv",
                    "nameroot": "refgene",
                    "nameext": ".tsv"
                },
                "genome_size": "2.35e9",
                "chrom_length": {
                    "class": "File",
                    "location": "file:///wardrobe/indices/bowtie/hg19/chrNameLength.txt",
                    "format": "http://edamontology.org/format_2330",
                    "size": 376,
                    "basename": "chrNameLength.txt",
                    "nameroot": "chrNameLength",
                    "nameext": ".txt"
                }
            }
        }
    },
    {
        "_id": "Dic5dG9hTvmH3Qezt",
        "date": {
            "created": "2012-09-07T18:21:52.362Z"
        },
        "projectId": "Mrx3c92PKkipTBMsA",
        "preview": {
            "line1": "Mus musculus (mm10)",
            "line2": "Genome Reference Consortium Mouse Build 38 (mm10). Strain: C57BL/6J. 2012/01/09",
            "line3": "https://www.ncbi.nlm.nih.gov/assembly/GCF_000001635.20/"
        },
        "result_preview": {

        },
        "cwl": {
            "cwlId": "3PfggtmrE3FBdrPcy",
            "input": {
                "genome": "Mus musculus (mm10)",
                "fasta_input_file": {
                    "class": "File",
                    "location": "file:///wardrobe/indices/bowtie/mm10.fa",
                    "format": "http://edamontology.org/format_1929"
                }
            },
            "output": {
                "indices_folder": {
                    "class": "Directory",
                    "location": "file:///wardrobe/indices/bowtie/mm10",
                    "basename": "mm10"
                },
                "annotation_file": {
                    "class": "File",
                    "location": "file:///wardrobe/indices/annotations/mm10/refgene.tsv",
                    "format": "http://edamontology.org/format_3475",
                    "size": 8653806,
                    "basename": "refgene.tsv",
                    "nameroot": "refgene",
                    "nameext": ".tsv"
                },
                "genome_size": "2.0e9",
                "chrom_length": {
                    "class": "File",
                    "location": "file:///wardrobe/indices/bowtie/mm10/chrNameLength.txt",
                    "format": "http://edamontology.org/format_2330",
                    "size": 331,
                    "basename": "chrNameLength.txt",
                    "nameroot": "chrNameLength",
                    "nameext": ".txt"
                }
            }
        }
    }
];
