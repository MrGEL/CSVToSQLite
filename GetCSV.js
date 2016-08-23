var express = require('express');
var busboy = require('connect-busboy');
var fs = require('fs-extra');
var bodyParser = require('body-parser');
var csv = require('csv-parser');
var sqlite3 = require('sqlite3');

var app = express();
var sqlite3Db = new sqlite3.Database('csvDB');


function GetRowValues(data) {
    var rowValues =
        '(' + data.id + "," +
         "'" + data.Name + "'," +
         "'" + data.Surname + "'," + 
         "'" + data.Initials + "'," +
         data.Age + "," +
         "'" + data.DateOfBirth +"')";
    return rowValues;
}

function importCSVEnd() {
    console.log('CSV import end!');
}

function importCSVError(error) {
    console.log('CSV import error...');
}

var insertHeader = "insert into csv_import (id,Name,Surname,Initials,Age,DateOfBirth) " + "values ";
var insertStr = "";
var rowCounter = 0;
var totalCounter = 0;
function importCSVData(reader, data) {
    rowCounter += 1;
    totalCounter += 1;
    if(rowCounter === 1000) {
    
        reader.pause();
        rowCounter = 0;
        console.log('Reading rows...');
        var insertSql = insertHeader + insertStr + GetRowValues(data);
        console.log('Writing rows...');
        
        sqlite3Db.run(insertSql, function() {
            console.log('Rows written...');
            if((totalCounter % 10000) === 0) {
                console.log('Rows processed: ' + totalCounter + '...');
            }
            reader.resume();
        });
        
        insertStr = "";
    } else {
        insertStr += (GetRowValues(data) + ",");
    }
}

function ImportCSVtoSQLite(csvFile) {
    sqlite3Db.serialize(function() {
        debugger;
        var createStr =
            "create table csv_import "+
            "(id int,Name char(32),Surname char(32),Initials char(32),Age int,DateOfBirth char(32))";

        sqlite3Db.run(createStr, function() {
            console.log('Table crreated...');
            var reader = fs.createReadStream('Uploads/' + csvFile);
            var writer = reader.pipe(csv());
            writer.on('end', importCSVEnd);
            writer.on('error', importCSVError);
            writer.on('data', importCSVData.bind(null, reader));

        });
    });
}

process.on('SIGINT', onCtrlC);

app.use(busboy());
app.use(express.static('public'));
//app.use(bodyParser.json());

app.post('/', function(request, response) {
    console.log('post');
    debugger;
    var fstream;
    request.pipe(request.busboy);
    request.busboy.on('file', function(fieldName, file, fileName) {
        debugger;
        console.log('File received...');
        fstream = fs.createWriteStream(__dirname + '/Uploads/' + fileName);
        file.pipe(fstream);
        fstream.on('close', function() {
            console.log('File saved...');
            console.log('Importing to SQLite...');
            ImportCSVtoSQLite(fileName);
            response.redirect('back');
        });
    });
});

app.listen(8192, function () {
    console.log('SQLite CSV import web service listening on port 8192...');
});

function onProcessExit() {
    process.exit();
}

function onSqlite3Close() {
    console.log('SQLite database closed...');
    setTimeout(onProcessExit, 1000);
}

function onCtrlC() {
    if(sqlite3Db !== null) {
        sqlite3Db.close(onSqlite3Close);
    } else {
        process.exit();
    }
}
