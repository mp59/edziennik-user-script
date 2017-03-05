// ==UserScript==
// @name        edziennik
// @namespace   root
// @version     1
// @grant       none
// @include     *nasze.miasto.gdynia.pl/ed_miej/zest_ed_oceny_ucznia_szczegoly.pl*
// ==/UserScript==

var avgPlugin = {};
window.avgPlugin = avgPlugin;
this.avgPlugin = avgPlugin;

avgPlugin.getColumnScheme = function(gridTable) {
    var scheme = gridTable
        .find("#gridHeader > th")
        .toArray()
        .map(function(tag) {
            return $(tag).attr("column");
        });
    return scheme;
};

avgPlugin.getTagText = function(tag) {
    var text = $(tag).text().replace(/^\s*(.*?)\s*$/, "$1");
    var content = text.match(/^[0-9]+$/) ? parseInt(text) : text;
    return content;
};

avgPlugin.getRowData = function(rowEl, scheme) {
    var columnsText = rowEl
        .children("td")
        .toArray()
        .map(avgPlugin.getTagText);
    var rowData = {};
    for (var i=0; i < scheme.length; i++) {
        rowData[scheme[i]] = columnsText[i];
    }
    return rowData;
};

avgPlugin.getTableData = function(gridTable) {
    var scheme = avgPlugin.getColumnScheme(gridTable);
    var rows = gridTable.find("tbody > tr.dataRow").toArray().map(t => $(t));
    var data = rows.map(function(rowEl) {
        return avgPlugin.getRowData(rowEl, scheme);
    });
    return data;
};

avgPlugin.fetchTableData = function() {
    var table = $("#gridTable");
    return avgPlugin.getTableData(table);
};

// misc

avgPlugin.isCounted = function(rowData) {
    return rowData.czy_liczona_do_sredniej === "Tak";
};

avgPlugin.roundFloat = function(number, precision) {
    var multiplier = Math.pow(10, precision);
    return Math.round(number * multiplier) / multiplier;
};

// grades

avgPlugin.getGradeList = function(tableData) {
    var gradeRowsData = tableData.filter(avgPlugin.isCounted);
    var gradeList = gradeRowsData.map(function(rowData) {
        var grade = {
            value: rowData.wartosc,
            tier: rowData.waga,
        };
        return grade;
    });
    return gradeList;
};

avgPlugin.fetchGradeList = function() {
    return avgPlugin.getGradeList(avgPlugin.fetchTableData());
};

avgPlugin.calculateGradeAverage = function(gradeList) {
    var sum = 0,
        items = 0;
    gradeList.forEach(function(grade) {
        sum += grade.value * grade.tier;
        items += grade.tier;
    });
    return avgPlugin.roundFloat(sum / items, 2);
};

// score

avgPlugin.parseScore = function(scoreStr) {
    var scoreArray = scoreStr.split(/\//).map(str => parseInt(str));
    var score = {
        value: scoreArray[0] || 0,
        max: scoreArray[1] || 0,
    };
    return score;
};

avgPlugin.getRowScore = function(rowData) {
    if (rowData.osoba_wystawiajaca === "Parakiewicz Anna"
        && rowData.kategoria === "Praca domowa"
        && rowData.wartosc === 1
        && rowData.opis === "") {
        return {value: 0, max: 5};
    }
    else {
        return avgPlugin.parseScore(rowData.opis);
    }
};

avgPlugin.getScoreList = function(tableData) {
    var scoreRowsData = tableData.filter(avgPlugin.isCounted);
    // var scoreList = scoreRowsData.map(function(rowData) {
    //     return avgPlugin.parseScore(rowData.opis);
    // });
    var scoreList = scoreRowsData.map(avgPlugin.getRowScore);
    return scoreList;
};

avgPlugin.fetchScoreList = function() {
    return avgPlugin.getScoreList(avgPlugin.fetchTableData());
};

avgPlugin.calculateTotalScore = function(scoreList) {
    var totalScore = scoreList.reduce(function(acc, item) {
        acc.value += item.value;
        acc.max += item.max;
        return acc;
    }, {value: 0, max: 0});
    return totalScore;
};

avgPlugin.calculateScoreAverage = function(scoreList) {
    var totalScore = avgPlugin.calculateTotalScore(scoreList);
    var scoreAverage = (totalScore.value / totalScore.max) * 100;
    return avgPlugin.roundFloat(scoreAverage, 2);
};

avgPlugin.isScored = function(tableData) {
    tableData = tableData.filter(avgPlugin.isCounted);
    var scoredTeachers = ["Parakiewicz Anna", "Wasilewicz Leszek"];
    return tableData.every(function(rowData) {
        // console.log(rowData.osoba_wystawiajaca);
        return scoredTeachers.indexOf(rowData.osoba_wystawiajaca) !== -1;
    });
};

avgPlugin.getScoreAverageGrade = function(scoreAverage) {
    var score = Math.round(scoreAverage);
    if (score >= 96) {
        return 6;
    }
    else if (score >= 86) {
        return 5;
    }
    else if (score >= 71) {
        return 4;
    }
    else if (score >= 56) {
        return 3;
    }
    else if (score >= 40) {
        return 2;
    }
    else {
        return 1;
    }
};

// main

avgPlugin.fetchAverageData = function() {
    var tableData = avgPlugin.fetchTableData();
    var data = {};
    data.grade = avgPlugin.calculateGradeAverage(avgPlugin.getGradeList(tableData));
    if (avgPlugin.isScored(tableData)) {
        var scoreList = avgPlugin.getScoreList(tableData);
        data.scoreAverage = avgPlugin.calculateScoreAverage(scoreList);
        data.scoreGrade = avgPlugin.getScoreAverageGrade(data.scoreAverage);
        data.totalScore = avgPlugin.calculateTotalScore(scoreList);
    }
    else {
        data.score = null;
    }
    return data;
};

// view

avgPlugin.AverageGradeView = function(averageData) {
    this.averageData = averageData;
};

avgPlugin.AverageGradeView.prototype = {
    createListing: function(text) {
        var el =
            $("<td/>", {
                class: "listing"
            })
            .append(
                $("<strong/>")
                .text(text)
            );
        return el;
    },

    createElement: function() {
        var gradeText = isNaN(this.averageData.grade) ? "brak" : this.averageData.grade;
        var emptyListings = 8;
        var el =
            $("<tr/>", {
                class: "dataRow",
                id: "avgData",
            })
            .append(this.createListing("Średnia ocen:"))
            .append(this.createListing(gradeText));
        if (this.averageData.totalScore) {
            var data = this.averageData;
            var scoreText = data.scoreAverage + "%"
                + " (" + data.totalScore.value + "/" + data.totalScore.max + ")"
                + " [" + data.scoreGrade + "]";
            el.append(this.createListing("Punkty:"))
            el.append(this.createListing(scoreText));
            emptyListings -= 2;
        }
        for (var i = 0; i < emptyListings; i++) {
            el.append(this.createListing());
        }
        return el;
    },

    render: function() {
        var el = this.createElement();
        this.el && this.el.remove();
        var rows = $("#gridTable > tbody").children("tr:first, tr:last");
        this.el = el.insertAfter(rows);
    },
};

$(document).ready(function() {
    var averageData = avgPlugin.fetchAverageData();
    var averageView = new avgPlugin.AverageGradeView(averageData);
    averageView.render();
});
