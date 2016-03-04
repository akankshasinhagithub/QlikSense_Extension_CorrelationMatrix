/*
Created by Ralf Becher - ralf.becher@web.de - (c) 2015 irregular.bi, Leipzig, Germany
Tested on Qlik Sense 2.2.3

irregular.bi takes no responsibility for any code.
Use at your own risk. 
*/
define(["jquery", "qlik", "./scripts/d3.min", "./scripts/irregularUtils.min", "css!./styles/bi-irregular-correlation.css"],
    function ($, qlik, d3) {
        'use strict';

        return {
            initialProperties: {
                version: 1.0,
                qHyperCubeDef: {
                    qDimensions: [],
                    qMeasures: [],
                    qInitialDataFetch: [{
                        qWidth: 10,
                        qHeight: 50
				}]
                }
            },
            definition: {
                type: "items",
                component: "accordion",
                items: {
                    dimensions: {
                        uses: "dimensions",
                        min: 3
                    },
                    measures: {
                        uses: "measures",
                        min: 0,
                        max: 0
                    },
                    addons: {
                        uses: "addons",
                        items: {
                            dataHandling: {
                                uses: "dataHandling"
                            }
                        }
                    }
                }
            },
            snapshot: {
                canTakeSnapshot: false
            },
            paint: function ($element, layout) {
                var app = qlik.currApp(this);
                //console.log(layout.qHyperCube);
                var groupingField = layout.qHyperCube.qDimensionInfo[0].qGroupFieldDefs[0];
                var correlFields = layout.qHyperCube.qDimensionInfo.slice(1).map(function (d) {
                    return d.qGroupFieldDefs[0];
                });
                var cubeDef = {
                    "qDimensions": [],
                    "qMeasures": [],
                    "qSuppressZero": true,
                    "qSuppressMissing": true,
                    "qInitialDataFetch": [{
                        "qTop": 0,
                        "qHeight": 1,
                        "qLeft": 0,
                        "qWidth": 3
                        }]
                };
                var len = correlFields.length + 1;
                var matrix = new Array(len);
                var header = correlFields.slice(0);
                header.unshift("");
                for (var i = 0; i < len; i++) {
                    if (i == 0) {
                        matrix[i] = header;
                    } else {
                        matrix[i] = Array.apply(null, Array(len)).map(Number.prototype.valueOf, 1);;
                        matrix[i][0] = correlFields[i - 1];
                        for (var j = 2; j < len; j++) {
                            if (j > i) {
                                var a = matrix[i][0],
                                    b = matrix[0][j];
                                matrix[i][j] = a + "-" + b;
                                //                                cubeDef.qHyperCubeDef.qMeasures.push({
                                cubeDef.qMeasures.push({
                                    "qLibraryId": "",
                                    "qDef": {
                                        "qLabel": "Correlation " + a + "-" + b,
                                        "qDef": "Correl(TOTAL <" + groupingField + "> " + a + "," + b + ")"
                                    }
                                });
                            }
                        }
                    }
                }
                cubeDef.qInitialDataFetch[0].qWidth = cubeDef.qMeasures.length;

                app.createCube(cubeDef, function (data) {
                    var cube = data.qHyperCube.qDataPages[0].qMatrix;
                    if (cube.length > 0) {
                        var measure = 0;
                        for (var i = 1; i < len; i++) {
                            for (var j = 1; j < len; j++) {
                                if (j > i) {
                                    var v = isNaN(cube[0][measure].qNum) ? 0 : cube[0][measure].qNum;
                                    matrix[i][j] = v;
                                    matrix[j][i] = v;
                                    measure++;
                                }
                            }
                        }
                        viz($element, layout, matrix);
                    } else {
                        $element.empty();
                    }
                });
            }
        }
    });

function viz($element, layout, matrix) {
    var width = $element.width(); // space left for scrollbar
    // Chart object height
    var height = $element.height();
    // Chart object id
    var id = "container_" + layout.qInfo.qId;

    $element.empty().append($('<div />').attr({
        "id": id,
        "class": "qv-object-correlation-matrix"
    }).css({
        height: height,
        width: width,
        overflow: 'auto'
    }))

    // read in the CSV file and put the data in a d3 format or an array of objects
    var data = [];
    matrix.forEach(function (d, i) {
        if (i > 0) {
            for (var j = 1; j < d.length; j++) {
                data.push({
                    x: d[0],
                    y: matrix[0][j],
                    value: d[j]
                });
            }
        }
    });

    //console.log(JSON.stringify(data));

    // standard d3 plot setup
    var margin = {
            top: 40,
            right: 80,
            bottom: 80,
            left: 40
        },
        domain = d3.set(data.map(function (d) { // our domain is just the column names
            return d.x
        })).values(),
        num = Math.sqrt(data.length), // how many rows and columns
        color = d3.scale.linear() // our color scale from red to white to blue
        .domain([-1, 0, 1])
        .range(["#B22222", "#fff", "#000080"]);
    height -= 5; // prevent horizontal scrollbar
    width = Math.min(((matrix.length - 1) * 60) + (margin.left + margin.right) / 2, Math.min(height, width));
    height = Math.min(((matrix.length - 1) * 60) + (margin.top + margin.bottom) / 2, Math.min(height, width));

    width = width - margin.left - margin.right;
    height = height - margin.top - margin.bottom;

    // set-up x and y scale
    var x = d3.scale
        .ordinal()
        .rangePoints([0, width])
        .domain(domain),
        y = d3.scale
        .ordinal()
        .rangePoints([0, height])
        .domain(domain),
        xSpace = x.range()[1] - x.range()[0], // this is the space of each grid space
        ySpace = y.range()[1] - y.range()[0];

    var svg = d3.select("#" + id)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // bind our data for each grid space
    var cor = svg.selectAll(".cor")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "cor")
        .attr("transform", function (d) {
            return "translate(" + x(d.x) + "," + y(d.y) + ")";
        });

    // outer rectangle on each grid space
    cor.append("rect")
        .attr("width", xSpace)
        .attr("height", ySpace)
        .attr("x", -xSpace / 2)
        .attr("y", -ySpace / 2)

    // below the diagonal
    cor.filter(function (d) {
            var ypos = domain.indexOf(d.y);
            var xpos = domain.indexOf(d.x);
            if (xpos <= ypos) {
                return true;
            } else {
                return false;
            }
        })
        // append a text
        .append("text")
        .attr("y", 5)
        .text(function (d) {
            if (d.x === d.y) {
                return d.x;
            } else {
                return toLocalFixed(d.value, 2);
            }
        })
        // color it
        .style("fill", function (d) {
            if (d.value === 1) {
                return "#000";
            } else {
                return color(d.value);
            }
        })
        .append("title").text(function (d) {
            return "Correlation\n" + d.y + ' : ' + d.x + "\n" + toLocalFixedUnPadded(d.value, 8);
        });


    // above the diagonal
    cor.filter(function (d) {
            var ypos = domain.indexOf(d.y);
            var xpos = domain.indexOf(d.x);
            if (xpos > ypos) {
                return true;
            } else {
                return false;
            }
        })
        // add a circle
        .append("circle")
        .attr("r", function (d) {
            return (width / (num * 2)) * (Math.abs(d.value) + 0.1);
        })
        .style("fill", function (d) {
            if (d.value === 1) {
                return "#000080";
            } else {
                return color(d.value);
            }
        })
        .append("title").text(function (d) {
            return "Correlation\n" + d.y + ' : ' + d.x + "\n" + toLocalFixedUnPadded(d.value, 8);
        });


    // build the "yAxis" color scale
    // its a series of rects colored correctly
    // to produce a smooth gradient
    var aS = d3.scale
        .linear()
        //        .range([-margin.top + 5, height + margin.bottom - 5])
        .range([-margin.top + 14, height + 20])
        .domain([1, -1]);

    var yA = d3.svg.axis()
        .orient("right")
        .scale(aS)
        .tickPadding(7);

    var aG = svg.append("g")
        .attr("class", "y axis")
        .call(yA)
        .attr("transform", "translate(" + (width + margin.right / 2) + " ,0)")

    var iR = d3.range(-1, 1.01, 0.01);
    var h = height / iR.length + 3;
    iR.forEach(function (d) {
        aG.append('rect')
            .style('fill', color(d))
            .style('stroke-width', 0)
            .style('stoke', 'none')
            .attr('height', h)
            .attr('width', 10)
            .attr('x', 0)
            .attr('y', aS(d))
    });
}