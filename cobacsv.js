require([
    "esri/WebMap",
    "esri/views/MapView",
    "esri/layers/CSVLayer",
    "esri/layers/GraphicsLayer",
    "esri/widgets/Sketch/SketchViewModel",
    "esri/Graphic",
    "esri/widgets/Legend",
    "esri/widgets/Expand",
    "dgrid/OnDemandGrid",
    "dgrid/extensions/ColumnHider",
    "dojo/store/Memory",
    "dstore/legacy/StoreAdapter",
    "dgrid/Selection"
  ], function(
    WebMap,
    MapView,
    CSVLayer,
    GraphicsLayer,
    SketchViewModel,
    Graphic,
    Legend,
    Expand,
    OnDemandGrid,
    ColumnHider,
    Memory,
    StoreAdapter,
    Selection
  ) {
    let map, view, csvLayer, csvLayerView, sketchViewModel, highlight, grid;
    const gridDiv = document.getElementById("grid");
    const infoDiv = document.getElementById("info");
  
    let resultFeatures = [];
  
    // create new map, view and csvlayer
    setupTheView();
  
    // create a new sketchviewmodel, setup it properties
    // set up the click event for the select by polygon button
    setUpSketchViewModel();
    setupCSV();
    sketchViewModel.on("create-complete", function(event) {
      // this polygon will be used to query features that intersect it
      selectFeatures(event.geometry);
    });
  
    const gridFields = [
      "__OBJECTID",
      "Category",
      "Season",
      "Name",
      "Nature",
      "wmo_wind"
    ];
  
    // create a new datastore for the on demandgrid
    // will be used to display attributes of selected features
    const dataStore = new StoreAdapter({
      objectStore: new Memory({
        idProperty: "__OBJECTID"
      })
    });
  
    // create a grid with given columns once the csvlayer is loaded
    csvLayer
      .when(function() {
        // create a grid with columns specified in gridFields variable
        createGrid(csvLayer.fields);
  
        // get a reference the csvlayerview when it is ready. It will used to do
        // client side queries when user draws polygon to select features
        view.whenLayerView(csvLayer).then(function(layerView) {
          csvLayerView = layerView;
        });
      })
      .catch(errorCallback);
  
    /****************************************************
     * Selects features from the csv layer that intersect
     * a polygon that user drew using sketch view model
     ****************************************************/
    function selectFeatures(geometry) {
      view.graphics.removeAll();
      if (csvLayerView) {
        // create a query and set its geometry parameter to the
        // polygon that was drawn on the view
        const query = {
          geometry: geometry,
          outFields: ["*"]
        };
  
        // query graphics from the csv layer view. Geometry set for the query
        // can be polygon for point features and only intersecting geometries are returned
        csvLayerView
          .queryFeatures(query)
          .then(function(results) {
            const graphics = results.features;
            resultFeatures = graphics;
            // if the grid div is displayed while query results does not
            // return graphics then hide the grid div and show the instructions div
            if (graphics.length > 0) {
              // zoom to the extent of the polygon with factor 2
              view.goTo(geometry.extent.expand(2));
              gridDiv.style.zIndex = 90;
              infoDiv.style.zIndex = 80;
              document.getElementById("featureCount").innerHTML =
                "<b>Showing attributes for " +
                graphics.length.toString() +
                " features </b>";
            } else {
              gridDiv.style.zIndex = 80;
              infoDiv.style.zIndex = 90;
            }
  
            // remove existing highlighted features
            if (highlight) {
              highlight.remove();
            }
  
            // highlight query results
            highlight = csvLayerView.highlight(graphics);
  
            // get the attributes to display in the grid
            const data = graphics.map(function(feature, i) {
              return (Object.keys(feature.attributes)
                  .filter(function(key) {
                    // get fields that exist in the grid
                    return gridFields.indexOf(key) !== -1;
                  })
                  // need to create key value pairs from the feature
                  // attributes so that info can be displayed in the grid
                  .reduce(function(obj, key) {
                    obj[key] = feature.attributes[key];
                    return obj;
                  }, {}) );
            });
  
            // set the datastore for the grid using the
            // attributes we got for the query results
            dataStore.objectStore.data = data;
            grid.set("collection", dataStore);
          })
          .catch(errorCallback);
      }
    }
  
    /************************************************
     * fires when user clicks a row in the grid
     * get the corresponding graphic and select it
     *************************************************/
    function selectFeatureFromGrid(event) {
      // close view popup if it is open
      view.popup.close();
      // get the ObjectID value from the clicked row
      const row = event.rows[0];
      const id = row.data.__OBJECTID;
  
      // setup a query by specifying objectIds
      const query = {
        objectIds: [parseInt(id)],
        outFields: ["*"],
        returnGeometry: true
      };
  
      // query the csvLayerView using the query set above
      csvLayerView
        .queryFeatures(query)
        .then(function(results) {
          const graphics = results.features;
          resultFeatures = graphics;
          // remove all graphics to make sure no selected graphics
          view.graphics.removeAll();
  
          // create a new selected graphic
          const selectedGraphic = new Graphic({
            geometry: graphics[0].geometry,
            symbol: {
              type: "simple-marker",
              style: "circle",
              color: "orange",
              size: "12px", // pixels
              outline: {
                // autocasts as new SimpleLineSymbol()
                color: [255, 255, 0],
                width: 2 // points
              }
            }
          });
  
          // add the selected graphic to the view
          // this graphic corresponds to the row that was clicked
          view.graphics.add(selectedGraphic);
        })
        .catch(errorCallback);
    }
  
    /************************************************
     * Creates a new grid. Loops through poverty
     * csvLayer's fields and creates grid columns
     * Grid with selection and columnhider extensions
     *************************************************/
    function createGrid(fields) {
      var columns = fields
        .filter(function(field, i) {
          if (gridFields.indexOf(field.name) !== -1) {
            return field;
          }
        })
        .map(function(field) {
          if (field.name === "__OBJECTID") {
            return {
              field: field.name,
              label: field.name,
              sortable: true,
              hidden: true
            };
          } else {
            return {
              field: field.name,
              label: field.alias,
              sortable: true
            };
          }
        });
  
      // create a new onDemandGrid with its selection and columnhider
      // extensions. Set the columns of the grid to display attributes
      // the hurricanes cvslayer
      grid = new (OnDemandGrid.createSubclass([Selection, ColumnHider]))(
        {
          columns: columns
        },
        "grid"
      );
  
      // add a row-click listener on the grid. This will be used
      // to highlight the corresponding feature on the view
      grid.on("dgrid-select", selectFeatureFromGrid);
    }
  
    /************************************************************************
     * Sets up the sketchViewModel. When user clicks on the select by polygon
     * button sketchViewModel.create() method is called with polygon param.
     ************************************************************************/
    function setUpSketchViewModel() {
      // polygonGraphicsLayer will be used by the sketchviewmodel
      // show the polygon being drawn on the view
      const polygonGraphicsLayer = new GraphicsLayer();
      map.add(polygonGraphicsLayer);
  
      // add the select by polygon button the view
      view.ui.add("select-by-polygon", "top-left");
      const selectButton = document.getElementById("select-by-polygon");
  
      // click event for the button
      selectButton.addEventListener("click", function() {
        clearUpSelection();
        view.popup.close();
        // ready to draw a polygon
        sketchViewModel.create("polygon");
      });
  
      // create a new sketch view model set its layer
      sketchViewModel = new SketchViewModel({
        view: view,
        layer: polygonGraphicsLayer,
        pointSymbol: {
          type: "simple-marker",
          color: [255, 255, 255, 0],
          size: "1px",
          outline: {
            color: "gray",
            width: 0
          }
        }
      });
    }
  
    function clearUpSelection() {
      view.graphics.removeAll();
      grid.clearSelection();
    }
    /******************************************************
     * Sets up the view. WebMap with winkel III projection
     * basemap and hurricanes CsvLayer is added to the view.
     ******************************************************/
    function setupTheView() {
      const url =
        "https://arcgis.github.io/arcgis-samples-javascript/sample-data/hurricanes.csv";
  
      csvLayer = new CSVLayer({
        title: "Hurricanes",
        url: url,
        copyright: "NOAA",
        popupTemplate: {
          title: "{Name}",
          content: [
            {
              type: "text",
              text: "Category {Category} storm with that occurred at {ISO_time}."
            },
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "wmo_pres",
                  label: "Pressure"
                },
                {
                  fieldName: "wmo_wind",
                  label: "Wind Speed (mph)"
                }
              ]
            }
          ],
          fieldInfos: [
            {
              filedName: "ISO_time",
              format: {
                dateFormat: "short-date-short-time"
              }
            }
          ]
        },
        renderer: {
          type: "unique-value",
          field: "Category",
          uniqueValueInfos: createUniqueValueInfos()
        }
      });
  
      map = new WebMap({
        // contains a basemap with a Winkel III projection
        // the CSVLayer coordinates will re-project client-side
        portalItem: {
          id: "7d127cef99a44327b79f5185602b8b6b"
        },
        layers: [csvLayer]
      });
  
      view = new MapView({
        container: "viewDiv",
        map: map,
        highlightOptions: {
          color: "#2B65EC",
          fillOpacity: 0.4
        },
        padding: {
          bottom: infoDiv.clientHeight // Same value as the #infoDiv height in CSS
        }
      });
  
      const legendExpand = new Expand({
        view: view,
        content: new Legend({
          view: view,
          style: "card"
        })
      });
      view.ui.add(legendExpand, "top-left");
  
      view.popup.watch("visible", function(newValue) {
        if (newValue) {
          clearUpSelection();
        }
      });
    }
  
    /*********************************************************
     * Used to create uniques values for the csvlayer renderer
     *********************************************************/
    function createUniqueValueInfos() {
      const fireflyImages = [
        "cat1.png",
        "cat2.png",
        "cat3.png",
        "cat4.png",
        "cat5.png"
      ];
  
      const baseUrl =
        "https://arcgis.github.io/arcgis-samples-javascript/sample-data/";
  
      return fireflyImages.map(function(url, i) {
        return {
          value: i + 1, // Category number
          symbol: {
            type: "picture-marker",
            url: baseUrl + url
          }
        };
      });
    }
  
    function errorCallback(error) {
      console.log("error:", error);
    }
  
    /*********************************************************
     * Set up CSV export
     *********************************************************/
    
    function setupCSV() {
      view.ui.add("btn-export", "top-left");
      const btn = document.getElementById("btn-export");
      btn.addEventListener("click", () => {
        if (resultFeatures.length) {
          // export to csv
          const attrs = resultFeatures.map(a => a.attributes);
          const headers = {};
          const entry = attrs[0];
          for (let key in entry) {
            if (entry.hasOwnProperty(key)) {
              headers[key] = key;
            }
          }
          exportCSVFile(headers, attrs, "export");
        }
      });
    }
  
    // export functions
    // https://medium.com/@danny.pule/export-json-to-csv-file-using-javascript-a0b7bc5b00d2
    function convertToCSV(objArray) {
      const array = typeof objArray != "object" ? JSON.parse(objArray) : objArray;
      let str = "";
  
      for (let i = 0; i < array.length; i++) {
        let line = "";
        for (let index in array[i]) {
          if (line != "") line += ",";
  
          line += array[i][index];
        }
  
        str += line + "\r\n";
      }
  
      return str;
    }
  
    function exportCSVFile(headers, items, fileTitle) {
      if (headers) {
        items.unshift(headers);
      }
  
      // Convert Object to JSON
      var jsonObject = JSON.stringify(items);
  
      const csv = convertToCSV(jsonObject);
  
      const exportedFilenmae = fileTitle + ".csv" || "export.csv";
  
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      if (navigator.msSaveBlob) {
        // IE 10+
        navigator.msSaveBlob(blob, exportedFilenmae);
      } else {
        const link = document.createElement("a");
        if (link.download !== undefined) {
          // feature detection
          // Browsers that support HTML5 download attribute
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", exportedFilenmae);
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    }
  });
  