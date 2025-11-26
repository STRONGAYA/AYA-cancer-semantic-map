# AYA-cancer-data-semantic-map 
<p align="center">
<a href="https://doi.org/10.5281/zenodo.17521899"><img alt="DOI: 10.5281/zenodo.17521900 " src="https://zenodo.org/badge/DOI/10.5281/zenodo.17521900.svg"></a>
<a href="https://opensource.org/licenses/Apache-2.0"><img alt="Licence: Apache 2.0" src="https://img.shields.io/badge/Licence-Apache%202.0-blue.svg"></a>
<br>
<a href="https://github.com/alex-shpak/hugo-book"><img alt="Hugo" src="https://img.shields.io/badge/Hugo-hugo book-cd007b.svg"></a>
<a href="https://github.com/MaastrichtU-CDS/Flyover"><img alt="Flyover version 2.0+" src="https://img.shields.io/badge/Flyover%20Version-2.0+-purple"></a>
</p>
Semantic map of the important AYA data elements collected for STRONG AYA

## **What is the purpose of this repository?**
This repository contains the semantic map of the AYA data elements collected for STRONG AYA.  
The semantic map is in the form of a JSON file and is used to facilitate:
- Interoperability across various datasets;  
- AYA cancer knowledge graph creation.  

## **How is this repository organised?**
The repository is organised as follows:
Every branch corresponds to a different dataset with -in the case of retrospective data- different elements.  
As different retrospective datasets are added,
new elements should be specified for the given dataset in its respective branch.  
The differences should then be merged through these branches to make up a global semantic map in the main branch.

## **How can this repository be used?**
The JSON file can be used with the annotation helper in the [Flyover tool](https://github.com/MaastrichtU-CDS/Flyover).

## **How was this work funded?**

This work and the associated scientific publication (https://doi.org/10.1101/2025.06.03.25328788) were predominantly
supported by the European Union’s Horizon 2020 research and innovation programme through _The STRONG-AYA Initiative_
(Grant agreement ID: 101057482).
