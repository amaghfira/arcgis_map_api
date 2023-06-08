// ---------- GET JSON ------------------
// Replace 'url' with the actual URL of your JSON data
const url =
"https://arcgis-spasial.kaltimprov.go.id/arcgis/rest/services/Publikasi?f=pjson";

fetch(url)
.then((response) => response.json())
.then((data) => {
    // Data is the parsed JSON object
    const services = data.services;

    // Create a select element
    const selectElement = document.getElementById("mapSelect");

    // event listener for element change
    selectElement.addEventListener("change", () => {

    // Get the selected value
    const selectedValue = selectElement.value;

    // Extract the desired name from the service name
    // const extractedName = selectedValue.split("/")[1];
    console.log(selectedValue);

    // Generate the URL for the selected service
    const selectedServiceURL = `https://arcgis-spasial.kaltimprov.go.id/arcgis/rest/services/${selectedValue}/MapServer?f=pjson`;
    console.log(selectedServiceURL);

    // Fetch JSON data from the selected service URL
    fetch(selectedServiceURL)
        .then((response) => response.json())
        .then((jsonData) => {
        // Process the fetched JSON data here
        const layers = jsonData.layers;
        console.log(layers);

        const selectPolygon = document.getElementById("polygonSelect");
        selectPolygon.innerHTML = "";
        // Iterate over the layers array and create an option for each layer
        layers.forEach((layer) => {
            const optionElement2 = document.createElement("option");
            optionElement2.value = layer.id;
            optionElement2.text = layer.name;
            selectPolygon.appendChild(optionElement2);
        });
        let selectedPolygonValue = selectPolygon.value;
        const selectedPolygonURL = `https://arcgis-spasial.kaltimprov.go.id/arcgis/rest/services/${selectedValue}/MapServer/${selectedPolygonValue}?f=pjson`;
        console.log(selectedPolygonURL);

        fetch(selectedPolygonURL)
            .then((response) => response.json())
            .then((jsonPeta) => {
            const fields = jsonPeta.fields;
            console.log(jsonPeta.fields[1]);

            // ----------  //
            // CREATE MAP //
            // ----------//

            require([
                "esri/Map",
                "esri/views/MapView",
                "esri/layers/MapImageLayer",
            ], (Map, MapView, MapImageLayer) => {
                const map = new Map({
                basemap: "streets-navigation-vector",
                });

                const view = new MapView({
                container: "viewDiv",
                map: map,
                center: [113.7884531, 0.0984726],
                zoom: 5,
                });
                


                /********************
                 * Add feature layer
                 ********************/

                // we use MapImageLayer as not all polygon have same features 
                
                // Add MapImageLayer
                let imageLayer;

                // template to be placed in popupTemplate
                const template = {
                    title: "{name}",
                    lastEditInfoEnabled: false,
                    actions: [
                        {
                            id: `${selectedPolygonValue}`,
                            title: "Peta",
                        },
                    ],
                    content: [
                        {type: "fields", fieldInfos: getCustomFieldInfos(jsonPeta)}
                    ]
                }

                console.log(template);

                // function to get fieldInfos dynamically 
                function getCustomFieldInfos(jsonPeta) {
                    const fields = jsonPeta.fields;
                    const fieldInfos = [];
                  
                    fields.forEach((field) => {
                        const fieldInfo = {
                          fieldName: field.name,
                          label: field.alias,
                          visible: true,
                        };
                        fieldInfos.push(fieldInfo);
                    });
                  
                    return fieldInfos;
                }

                // -------------------------
                // Export to csv function 
                const exportButton = document.getElementById("exportButton");
                exportButton.addEventListener("click", exportToCSV);

                function exportToCSV() {
                    const selectedPolygonURL = `https://arcgis-spasial.kaltimprov.go.id/arcgis/rest/services/${selectedValue}/MapServer/${selectedPolygonValue}/query?where=1=1&f=json`;
                
                    fetch(selectedPolygonURL)
                        .then((response) => response.json())
                        .then((jsonData) => {
                        const features = jsonData.features;
                        const csvData = convertFeaturesToCSV(features);
                        downloadCSV(csvData, "data.csv");
                        })
                        .catch((error) => {
                        console.log("Error fetching JSON data:", error);
                        });
                }
                
                function convertFeaturesToCSV(features) {
                    const csvRows = [];
                    const fieldsSet = new Set();
                    
                    // Extract field names from all features
                    features.forEach((feature) => {
                        const attributes = feature.attributes;
                        const featureFields = Object.keys(attributes);
                        featureFields.forEach((field) => fieldsSet.add(field));
                    });

                    // Convert set of field names to an array
                    const fields = Array.from(fieldsSet);

                    // Add header row
                    const headerRow = fields.join(",");
                    csvRows.push(headerRow);
                  
                    // Add data rows
                    features.forEach((feature) => {
                      const attributes = feature.attributes;
                      const rowData = fields.map((field) => attributes[field]);
                      const csvRow = rowData.join(";");
                      csvRows.push(csvRow);
                    });
                  
                    // Combine rows into a single CSV string
                    const csvData = csvRows.join("\n");
                    return csvData;
                }
                  
                  
                
                function downloadCSV(csvData, fileName) {
                    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
                    
                    // Check if the browser supports the `navigator.msSaveBlob` method (for IE)
                    if (navigator.msSaveBlob) {
                        navigator.msSaveBlob(blob, fileName);
                    } else {
                        // Create a temporary link element
                        const link = document.createElement("a");
                        if (link.download !== undefined) {
                        // Set the download attribute and filename
                        link.setAttribute("href", URL.createObjectURL(blob));
                        link.setAttribute("download", fileName);
                    
                        // Append the link to the body and trigger the download
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        }
                    }
                }
                  
                // end export to csv functions 
                // -----------------------------

                // get image layer
                const updateMapImageLayer = () => {
                    if (imageLayer) {
                      map.remove(imageLayer);
                    }
                
                
                imageLayer = new MapImageLayer({
                url: `https://arcgis-spasial.kaltimprov.go.id/arcgis/rest/services/${selectedValue}/MapServer`,
                sublayers: [
                    {
                        id:parseInt(selectedPolygonValue),
                        visible:true,
                        popupTemplate: template
                    }
                ]   
                });
                console.log("featurelayer: ", imageLayer);
                map.add(imageLayer);
                };

                updateMapImageLayer();

                view.when(() => {
                // Watch for when features are selected
                view.popup.watch("selectedFeature", (graphic) => {
                    if (graphic) {
                    // Set the action's visible property to true if the 'website' field value is not null, otherwise set it to false
                    const graphicTemplate =
                        graphic.getEffectivePopupTemplate();
                    graphicTemplate.actions.items[0].visible = graphic
                        .attributes.website
                        ? true
                        : false;
                    }
                });

                selectPolygon.addEventListener("change", () => {
                    selectedPolygonValue = selectPolygon.value;
                    updateMapImageLayer();
                });
                

                const popup = view.popup;
                popup.viewModel.on("trigger-action", (event) => {
                    if (event.action.id === `${selectedPolygonValue}`) {
                    const attributes =
                        popup.viewModel.selectedFeature.attributes;
                    console.log(attributes);
                    // Get the 'website' field attribute
                    const info = attributes.website;
                    // Make sure the 'website' field value is not null
                    if (info) {
                        // Open up a new browser using the URL value in the 'website' field
                        window.open(info.trim());
                    }
                    }
                });
                });
            });
            });
        })
        .catch((error) => {
        console.log("Error fetching JSON data:", error);
        });
    });

    // Iterate over the services array and create an option for each service
    services.forEach((service) => {
        const optionElement = document.createElement("option");
        optionElement.value = service.name;
        optionElement.text = service.name;
        selectElement.appendChild(optionElement);
    });
})
.catch((error) => {
    console.log("Error fetching JSON data:", error);
});

