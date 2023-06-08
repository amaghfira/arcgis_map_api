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
            console.log(fields[1]["name"]);

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

                // Add MapImageLayer
                let imageLayer;

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
                        popupTemplate: {
                            title: "{name}",
                            lastEditInfoEnabled: false,
                            actions: [
                            {
                                id: `${selectedPolygonValue}`,
                                title: "Peta",
                            },
                            ],
                            content: " kode prov: {provno}"
                        },
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

