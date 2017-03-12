// ==UserScript==
// @name        edziennik
// @namespace   root
// @version     2
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
    var rows = gridTable.find("tbody > tr.dataRow").not(".potentialRow").toArray().map(t => $(t));
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
    var scoreList = scoreRowsData.map(function(rowData) {
        return rowData.score || avgPlugin.getRowScore(rowData);
    });
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
    if (tableData.every(rowData => typeof rowData.scored !== "undefined")) {
        return tableData.every(rowData => rowData.scored);
    }
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

avgPlugin.transformTableData = function(tableData) {
    var isScored = avgPlugin.isScored(tableData);
    return tableData.map(function(rowData) {
        rowData.score = avgPlugin.getRowScore(rowData);
        rowData.scored = isScored;
        return rowData;
    });
};

avgPlugin.getAverageData = function(tableData) {
    var data = {};
    data.grade = avgPlugin.calculateGradeAverage(avgPlugin.getGradeList(tableData));
    if (avgPlugin.isScored(tableData)) {
        var scoreList = avgPlugin.getScoreList(tableData);
        data.scoreAverage = avgPlugin.calculateScoreAverage(scoreList);
        data.scoreGrade = avgPlugin.getScoreAverageGrade(data.scoreAverage);
        data.totalScore = avgPlugin.calculateTotalScore(scoreList);
    }
    else {
        data.scoreAverage = null;
        data.scoreGrade = null;
        data.totalScore = null;
    }
    return data;
};

avgPlugin.fetchAverageData = function() {
    var tableData = avgPlugin.fetchTableData();
    return avgPlugin.getAverageData(tableData);
};

//
//

avgPlugin.objectsEqual = function(o1, o2) {
    if (typeof o1 !== "object" || typeof o2 !== "object") {
        return o1 === o2;
    }
    if (o1 === null || o2 === null) {
        return o1 === o2;
    }
    var keys1 = Object.keys(o1).sort(),
        keys2 = Object.keys(o2).sort();
    if (keys1.length !== keys2.length) {
        return false;
    }
    else if (!keys1.every(function(key1, index) {
        return key1 === keys2[index];
    })) {
        return false;
    }
    else if (!keys1.every(function(key) {
        return avgPlugin.objectsEqual(o1[key] ,o2[key]);
    })) {
        return false;
    }
    else {
        return true;
    }
};

avgPlugin.getObjectTemplate = function(object) {
    var wrapper = function(dataOverride) {
        dataOverride = dataOverride || {};
        return $.extend(true, {}, object, dataOverride);
    };
    return wrapper;
};

avgPlugin.sampleTemplate = `
    {{% if (xd) { }}
        <a>{{# first }}</a>
    {{% } }}
    <strong>{{# second }}</strong>`;

avgPlugin.getTemplate = function(text) {
    text = text.split(/\n/).map(function(line) {
        return line.replace(/^\s*/, "");
    }).join("");
    var evaluateRegex = /{{#(.+?)}}/g;
    var embedRegex = /{{%(.+?)}}/g;
    var regex = RegExp([evaluateRegex.source, embedRegex.source].join("|") + "|$", "g");
    var index = 0;
    var source = 'var __s="";';
    text.replace(regex, function(match, evaluate, embed, offset) {
        // console.log(match);
        source += "__s+=" + '\'' + text.slice(index, offset) + '\';';
        index = offset + match.length;
        if (evaluate) {
            source += "__s+=" + evaluate + ";";
        }
        else if (embed) {
            source += embed;
        }
    });
    source = "with(data) {" + source + "return __s;" + "}";
    // return source;
    return new Function("data", source);
};

avgPlugin.Events = function(sender) {
    this.sender = sender;
    this.callbacks = {};
    this.bound = [];
};

avgPlugin.Events.prototype = {
    listen: function(name, callback, listener) {
        if (this.callbacks[name] === undefined) {
            this.callbacks[name] = [];
        }
        this.callbacks[name].push({callback: callback, listener: listener});
        // console.log(this.callbacks[name]);
    },

    unlisten: function(name, listener) {
        this.callbacks[name] = this.callbacks[name].filter(i => i.listener !== listener);
    },

    bind: function(callback, listener) {
        this.bound.push({
            callback: callback,
            listener: listener,
        });
    },

    unbind: function(listener) {
        this.bound = this.bound.filter(i => i.listener !== listener);
    },

    erase: function(listener) {
        this.unbind(listener);
        var self = this;
        Object.keys(this.callbacks).forEach(function(name) {
            self.unlisten(name, listener);
        });
    },

    trigger: function(name, data) {
        var self = this;
        if (this.callbacks[name]) {
            this.callbacks[name].forEach(function(item) {
                item.callback(data, self.sender);
            });
        }
        this.bound.forEach(function(item) {
            item.callback(name, data, self.sender);
        });
    },
};


avgPlugin.EventedObject = function() {
    this._events = new avgPlugin.Events(this);
    this._senders = [];
};

avgPlugin.EventedObject.prototype.trigger = function(name, data) {
    this._events.trigger(name, data);
};

avgPlugin.EventedObject.prototype.listenTo = function(sender, name, callback) {
    sender._events.listen(name, callback, this);
    this._registerSender(sender);
};

avgPlugin.EventedObject.prototype.stopListening = function(source, name) {
    source._events.unlisten(name, this);
};

avgPlugin.EventedObject.prototype.bindEvents = function(sender) {
    var self = this;
    sender._events.bind(function(name, data, sender) {
        self.trigger(name, data);
    }, this);
    this._registerSender(sender);
};

avgPlugin.EventedObject.prototype.unbindEvents = function(sender) {
    sender._events.unbind(this);
};

avgPlugin.EventedObject.prototype._registerSender = function(sender) {
    if (this._senders.indexOf(sender) === -1) {
        this._senders.push(sender);
    }
};

avgPlugin.EventedObject.prototype._unregisterSender = function(sender) {
    this._senders = this._senders.filter(s => s !== sender);
};

avgPlugin.EventedObject.prototype.eraseCallbacks = function(sender) {
    sender._events.erase(this);
    this._unregisterSender(sender);
};

avgPlugin.EventedObject.prototype.eraseAllCallbacks = function() {
    var self = this;
    this._senders.forEach(function(sender) {
        self.eraseCallbacks(sender);
    });
};


avgPlugin.Model = function(data) {
    avgPlugin.EventedObject.call(this);
    this.data = data || this.defaults || {};
};

avgPlugin.Model.prototype = Object.create(avgPlugin.EventedObject.prototype);
avgPlugin.Model.prototype.set = function(data) {
    if (!avgPlugin.objectsEqual(this.data, data)) {
        this.data = data;
        this.trigger("change", this);
    }
};

avgPlugin.Model.prototype.update = function(data) {
    if (!avgPlugin.objectsEqual(this.data, data)) {
        $.extend(true, this.data, data);
        this.trigger("change", this);
    }
};

avgPlugin.Model.prototype.get = function(property) {
    return this.data[property];
};

avgPlugin.Model.prototype.toJSON = function() {
    return this.data;
};

avgPlugin.Model.prototype.remove = function() {
    this.trigger("delete", this);
};


avgPlugin.Collection = function(data, options) {
    avgPlugin.EventedObject.call(this);
    options = options || {};
    this.modelConstructor = options.model || avgPlugin.Model;
    this.models = [];

    var self = this;
    this.listenTo(this, "delete", function(model, sender) {
        self.remove(model);
    });
};

avgPlugin.Collection.prototype = Object.create(avgPlugin.EventedObject.prototype);
avgPlugin.Collection.prototype._silentAdd = function(modelData) {
    var model = new this.modelConstructor(modelData);
    var self = this;
    // this.listenTo(model, "delete", function(model) {
    //     self.remove(model);
    // });
    this.bindEvents(model);
    this.models.push(model);
    return model;
};

avgPlugin.Collection.prototype.add = function(modelData) {
    var model = this._silentAdd(modelData);
    this.trigger("add", model);
};

avgPlugin.Collection.prototype.remove = function(model) {
    this.models = this.models.filter(m => m !== model);
    this.trigger("remove", model);
};

avgPlugin.Collection.prototype.reset = function(collectionData) {
    var self = this;
    this.models.forEach(function(model) {
        self.remove(model);
    });
    collectionData.forEach(function(modelData) {
        self._silentAdd(modelData);
    });
    this.trigger("reset", this.models);
};

avgPlugin.Collection.prototype.toJSON = function() {
    return this.models.map(m => m.toJSON());
};

avgPlugin.View = function(options) {
    avgPlugin.EventedObject.call(this);
    options = options || {};
    // console.log(options);
    this.model = options.model;
    this.template = options.template ? avgPlugin.getTemplate(options.template) : undefined;
    if (options.el) {
        this.el = options.el;
    }
    else {
        options.tagName = options.tagName || "div";
        options.attr = options.attr || {};
        options.attr.class = options.attr.class || options.tagClass || "";
        this.el = $("<" + options.tagName + "/>", options.attr);
    }
};

avgPlugin.View.prototype = Object.create(avgPlugin.EventedObject.prototype);
avgPlugin.View.prototype.render = function() {
    var content = this.template(this.model.toJSON());
    this.el.html(content);
    return this;
};

avgPlugin.View.prototype.remove = function() {
    this.el.remove();
    this.eraseAllCallbacks();
};

avgPlugin.CollectionView = function(options) {
    options = options || {};
    options.model = undefined;
    avgPlugin.View.call(this, options);
    this.viewConstructor = options.view;
    this.collection = options.collection;
    this.views = [];
};

avgPlugin.CollectionView.prototype = Object.create(avgPlugin.View.prototype);
avgPlugin.CollectionView.prototype.add = function(model) {
    var view = new this.viewConstructor({model: model}).render();
    this.el.append(view.el);
    this.views.push(view);
};

avgPlugin.CollectionView.prototype.remove = function(model) {
    var toRemove = this.views.find(v => v.model === model);
    toRemove.remove();
    this.views = this.views.filter(v => v !== toRemove);
};

// custom

avgPlugin.zeroPad = function(number, length) {
    numberString = typeof number === "string" ? number : number.toString();
    if (numberString.length > length) {
        length = numberString.length;
    }
    var zeroStr = Math.pow(10, length - numberString.length).toString().slice(1);
    return zeroStr + numberString;
};

avgPlugin.formatDate = function(date) {
    var twoZeroPad = function(number) {
        return avgPlugin.zeroPad(number, 2);
    };
    var dateStr =
        [date.getDate(), date.getMonth() + 1, date.getUTCFullYear().toString().slice(-2)]
        .map(twoZeroPad)
        .join("/");
    var timeStr =
        [date.getHours(), date.getMinutes(), date.getSeconds()]
        .map(twoZeroPad)
        .join(":");
    return [dateStr, timeStr].join(" ");
};

avgPlugin.RowCollection = function() {
    avgPlugin.Collection.call(this);
    // this.dataTemplate = avgPlugin.getObjectTemplate({});
    this.setDataTemplate();
};

avgPlugin.RowCollection.prototype = Object.create(avgPlugin.Collection.prototype);
avgPlugin.RowCollection.prototype.fetch = function(options) {
    options = options || {reset: true};
    var data = avgPlugin.transformTableData(avgPlugin.fetchTableData());
    this.reset(data);
    this.setDataTemplate();
};

avgPlugin.RowCollection.prototype.setDataTemplate = function() {
    var data = {
        kategoria: "",
        kategoria_opis: "",
        czy_liczona_do_sredniej: "Tak",
        czy_ind: "Nie",
        opis: "",
        data_wystawienia: (function() {
            var date = new Date();
            return avgPlugin.formatDate(date);
        })(),
        osoba_wystawiajaca: "?",
        // changeable
        symbol: 6,
        wartosc: 6,
        waga: 1,
    };
    if (this.models.length) {
        data.osoba_wystawiajaca = this.models[0].get("osoba_wystawiajaca");
    }
    if (avgPlugin.isScored(this.toJSON())) {
        data.score = {value: 10, max: 10};
        data.scored = true;
    }
    else {
        data.score = {value: 0, max: 0};
        data.scored = false;
    }
    data.opis = data.score.value + "/" + data.score.max;
    this.dataTemplate = avgPlugin.getObjectTemplate(data);
};

avgPlugin.RowCollection.prototype.add = function(modelData) {
    var modelData = this.dataTemplate(modelData);
    modelData.data_wystawienia = avgPlugin.formatDate(new Date());
    return avgPlugin.Collection.prototype.add.call(this, modelData);
};


avgPlugin.AverageModel = function(options) {
    avgPlugin.Model.call(this);
    options = options || {};
    this.rowCollection = options.collection;

    var fetch = this.fetch.bind(this);
    this.listenTo(this.rowCollection, "reset", fetch);
    this.listenTo(this.rowCollection, "add", fetch);
    this.listenTo(this.rowCollection, "remove", fetch);
    this.listenTo(this.rowCollection, "change", fetch);
};

avgPlugin.AverageModel.prototype = Object.create(avgPlugin.Model.prototype);
avgPlugin.AverageModel.prototype.fetch = function() {
    var tableData = this.rowCollection.toJSON();
    var averageData = avgPlugin.getAverageData(tableData);
    this.set(averageData);
};


avgPlugin.rowTemplateTemplate = {
    kategoria: `
        <td class="listing" id="kategoria">
            <button type="button" id="close" style="color: red">❌</button>{{# kategoria}}
        </td>`,
    kategoria_opis: `
        <td class="listing" id="kategoria_opis">{{# kategoria_opis}}</td>`,
    symbol: `
        <td class="listing" id="symbol">{{# wartosc }}</td>`,
    wartosc: `
        <td class="listing" id="wartosc">
            <input type="number" min="1" max="6" style="width: 50px" value={{# wartosc }}>
        </td>`,
    waga: `
        <td class="listing" id="waga">
            <input type="number" min="0" style="width: 50px" value={{# waga }}>
        </td>`,
    czy_liczona_do_sredniej: `
        <td class="listing" id="czy_liczona_do_sredniej">
            <button type="button">{{# czy_liczona_do_sredniej}}</button>
        </td>`,
    czy_ind: `
        <td class="listing" id="czy_ind">{{# czy_ind}}</td>`,
    opis: `
        <td class="listing" id="opis">
        {{% if (scored) { }}
            <div style="display: table">
                <div style="display: table-cell">
                    <input id="value" type="number" min="0" style="width: 50px" value={{# score.value }}>
                </div>
                <div style="display: table-cell">
                    &nbsp;/&nbsp;
                </div>
                <div style="display: table-cell">
                    <input id="max" type="number" min="0" style="width: 50px" value={{# score.max }}>
                </div>
            </div>
        {{% } }}
        </td>`,
    data_wystawienia: `
        <td class="listing" id="data_wystawienia">{{# data_wystawienia}}</td>`,
    osoba_wystawiajaca: `
        <td class="listing" id="osoba_wystawiajaca">{{# osoba_wystawiajaca}}</td>`,
};

avgPlugin.rowTemplate = (function() {
    var scheme = avgPlugin.getColumnScheme($("#gridTable"));
    var template =
        scheme
        .map(name => avgPlugin.rowTemplateTemplate[name])
        .join("");
    return template;
})();

avgPlugin.RowView = function(options) {
    avgPlugin.View.call(this, {
        model: options.model,
        template: avgPlugin.rowTemplate,
        tagName: "tr",
        tagClass: "dataRow potentialRow",
    });
};

avgPlugin.RowView.prototype = Object.create(avgPlugin.View.prototype);
avgPlugin.RowView.prototype.render = function() {
    var data = this.model.toJSON();
    // data.scored = true;
    var content = this.template(data);
    this.el.html(content);
    console.log(this.el.find("#wartosc > input"));
    this.el.find("#wartosc > input").focus();

    var self = this;
    this.el.find("#close").click(function() {
        self.model.remove();
    });

    var valueInput = this.el.find("#wartosc > input");
    var tierInput = this.el.find("#waga > input");
    var gradeField = this.el.find("#symbol");
    var setValue = function() {
        var grade = parseInt($(this).val());
        if (isNaN(grade)) {
            return;
        }
        if (grade <= 0) {
            $(this).val(1);
            grade = 1;
        }
        if (grade > 6) {
            $(this).val(6);
            grade = 6;
        }
        // console.log(grade);
        self.el.find("#symbol").text(grade);
        self.model.update({
            wartosc: grade,
            symbol: grade,
        });
    };
    valueInput.keyup(setValue);
    valueInput.change(setValue);

    var setTier = function() {
        var tier = parseInt($(this).val());
        if (isNaN(tier)) {
            return;
        }
        if (tier < 0) {
            tier = 0;
            $(this).val(tier);
        }
        self.model.update({
            waga: tier,
        });
    };
    tierInput.keyup(setTier);
    tierInput.change(setTier);

    var scoreValueInput = this.el.find("#opis input#value");
    var scoreMaxInput = this.el.find("#opis input#max");
    var updateScore = function(value, max) {
        var grade = avgPlugin.getScoreAverageGrade(100 * (value/max));
        valueInput.val(grade);
        gradeField.text(grade);
        self.model.update({
            score: {
                value: value,
                max: max,
            },
            opis: value + "/" + max,
            wartosc: grade,
            symbol: grade,
        });
    };
    var setScoreValue = function() {
        var value = parseInt($(this).val()),
            max = self.model.get("score").max;
        if (isNaN(value)) {
            return;
        }
        if (value > max) {
            max = value;
            scoreMaxInput.val(max);
        }
        // console.log(value + "/" + max);
        updateScore(value, max);
    };
    scoreValueInput.change(setScoreValue);
    scoreValueInput.keyup(setScoreValue);

    var setScoreMax = function(check) {
        var max = parseInt($(this).val()),
            value = self.model.get("score").value;
        if (isNaN(max)) {
            return;
        }
        if (check && value > max) {
            value = max;
            scoreValueInput.val(value);
        }
        updateScore(value, max);
    };
    scoreMaxInput.change(function() {
        setScoreMax.bind(this)(true);
    });
    scoreMaxInput.keyup(function() {
        setScoreMax.bind(this)(false);
    });

    this.el.find("#czy_liczona_do_sredniej > button").click(function() {
        var value = $(this).text() === "Tak" ? "Nie" : "Tak";
        $(this).text(value);
        self.model.update({
            czy_liczona_do_sredniej: value,
        });
    });
    return this;
};

avgPlugin.RowCollectionView = function(options) {
    options = options || {};
    options.view = avgPlugin.RowView;
    options.el = $("#gridTable > tbody");
    avgPlugin.CollectionView.call(this, options);

    this.listenTo(this.collection, "add", this.add.bind(this));
    this.listenTo(this.collection, "remove", this.remove.bind(this));
};

avgPlugin.RowCollectionView.prototype = Object.create(avgPlugin.CollectionView.prototype);

avgPlugin.averageTemplate = `
<td class="listing">
    <strong>Średnia ocen: </strong>
</td>
<td class="listing">
    <strong>{{# grade }}</strong>
</td>
<td class="listing">
{{% if (scoreAverage) { }}
    <strong>Punkty:</strong>
{{% } }}
</td>
<td class="listing">
{{% if (scoreAverage) { }}
    <strong>{{# scoreAverage }}% [{{# totalScore.value }}/{{# totalScore.max }}] ({{# scoreGrade }})</strong>
{{% } }}
</td>
<td class="listing"></td>
<td class="listing"></td>
<td class="listing"></td>
<td class="listing"></td>
<td class="listing"></td>
<td class="listing">
    <button type="button" style="color: #184875">➕</button>
</td>
`;

avgPlugin.AverageView = function(options) {
    options = options || {};
    options.template = avgPlugin.averageTemplate;
    options.el = $("#gridTable > tfoot > tr:first");
    avgPlugin.View.call(this, options);

    this.listenTo(this.model, "change", this.render.bind(this));
};

avgPlugin.AverageView.prototype = Object.create(avgPlugin.View.prototype);
avgPlugin.AverageView.prototype.render = function() {
    var content = this.template(this.model.toJSON());
    this.el.html(content);

    var self = this;
    this.el.find("button").click(function() {
        self.model.rowCollection.add({});
    });
};

// specific helpers

avgPlugin.setupFoot = function() {
    var foot = $("<tfoot/>").appendTo($("#gridTable"));
    var el =
        $("<tr/>", {
            class: "dataRow"
        })
        .appendTo(foot);
    return el;
};

$(document).ready(function() {
    avgPlugin.setupFoot();
    var rowCollection = new avgPlugin.RowCollection();
    var average = new avgPlugin.AverageModel({collection: rowCollection});
    var rowCollectionView = new avgPlugin.RowCollectionView({collection: rowCollection});
    var averageView = new avgPlugin.AverageView({model: average});
    rowCollection.fetch();
});
