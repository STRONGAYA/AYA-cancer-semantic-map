# AYA-cancer-data-schema 
Schema of the important AYA data elements collected for STRONG AYA

## **What is the purpose of this repository?**
This repository contains the schema of the AYA data elements collected for STRONG AYA.  
The schema is in the form of a JSON file and is used to facilitate:
- Interoperability across various datasets;  
- AYA cancer knowledge graph creation.  

## **How is this repository organised?**
The repository is organised as follows:
Every branch corresponds to a different dataset with -in the case of retrospective data- different elements.  
As different retrospective datasets are added,
new elements should be specified for the given dataset in its respective branch.  
The differences should then be merged through these branches to make up a global schema in the main branch.

## **How can this repository be used?**
The JSON file can be used with the annotation helper in the [Flyover tool](https://github.com/MaastrichtU-CDS/Flyover).

## **How was this work funded?**

This work and the associated scientific publication -to follow- were predominantly
supported by the European Union’s Horizon 2020 research and innovation programme through _The STRONG-AYA Initiative_
(Grant agreement ID: 101057482).