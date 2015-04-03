/*
Package: go to chrome://extensions/, Pack extension, choose directory and pem, it creates a crx
Install: go to chrome://extensions/, drag crx onto page, might have to check Developer mode

Features
  -make it work for current, backlog, done
  -totals on top of My Work, and icebox?, and backlog and current?  yes, then you can see total for all releases, or if there is no release
  -mouseover popup display totals for points assigned to each person

To Do
  -handle multiple owners for a story (JA,JC) in tooltips
  -don't process hidden panels, but process them when they become visible
  -use jquery library used by pivotal, rather than packaging our own
  -show points accepted/total in mouseovers
  -make a new pane for Erbodys Work, summarize who has how many points overall and by state and project (if multiproj wksp), highlight yourself/put at top
  -handle size changes like different view modes for projector or dense

*/

var logDebug = false;
var powerTipOptions = { placement: 'w', smartPlacement: true };
var personColorMap = {};
function main2() {
	window.console.log('chrome-pivotal content.js main2');
	
	// add styles for tooltips
	$("<style>")
		.prop("type", "text/css")
		.html("\
			#powerTip {\
				position: absolute;\
				opacity: 1;\
				color: #EEEEEE;\
				background-color: #222222;\
				border: 1px solid #EEEEEE;\
				padding: 10px;\
				border-radius: 3px;\
			}\
			.peopleSummaryTip {\
				margin-bottom: -6px;\
			}\
			.peopleSummaryTip p {\
				margin-bottom: 6px;\
			}")
		.appendTo("head");
    
	// add listeners to each panel and process now
	// TODO ignore events from adding our divs, check ids or something
	$('.panel').each(function (i, e) {
		//window.console.log('main2 found .panel i=' + i + ' e=' + e);
		var panel = $(e);
		displayReleaseTotals(null, panel);
		//panel.on('DOMSubtreeModified', panel, displayReleaseTotals);
		panel.on('DOMSubtreeModified', handlePanelModified);
	});
}
function displayReleaseTotals(ev, panel) {
	if (logDebug) {
		//var evMsg = ev == null ? 'null' : '(relatedNode=' + ev.relatedNode + ',attrChange=' + ev.attrChange + ',attrName=' + ev.attrName + ')';
		var evMsg = ev == null ? 'null' : '(target.className=' + ev.target.className + ')';
		var panelMsg = panel == null ? 'null' : '(id=' + panel.id + ',className=' + panel.className + ')';
		window.console.log('displayReleaseTotals ev=' + evMsg + ' panel=' + panelMsg);
	}
	
	var _panel;
	if (panel != null) {
		_panel = $(panel);
	} else if (ev != null) {
		// don't process events caused by us
		//if (ev.relatedNode != null && ev.relatedNode.className === 'sprintSummary') return;
		if (ev.target != null && ev.target.className === 'sprintSummary') return;
		
		_panel = $(ev.currentTarget);
	}
	var panelItemsContainer = _panel.find('.items');
	var releasePoints = 0;
	var panelPoints = 0;
	var releasePeoplePoints = {};
	var panelPeoplePoints = {};
	
	panelItems = panelItemsContainer.children().children();
	panelItems.each(function (i, e) {
		var _e = $(e);
		if (_e.hasClass('release')) {
			if (logDebug) window.console.log('found release at ' + i);
			
			// display the total points of stories above this release
			var ee = _e.find('.sprintSummary');
			var totalDiv;
			if (ee.length > 0) {
				totalDiv = ee[0];
			} else {
				var totalDiv = document.createElement('div');
				totalDiv.className = 'sprintSummary name';
				totalDiv.style.position = 'relative';
				totalDiv.style.float = 'right';
				totalDiv.style.padding = '0px 3px';
				// enable powertip, content comes from data title
				$(totalDiv).powerTip(powerTipOptions);
				_e.find('.selector').after(totalDiv);
			}
			//totalDiv.innerText = totalDiv.innerText + 'Pts: ' + releasePoints;
			var newText = '&#8593; Pts: ' + releasePoints;
			if (totalDiv.innerHTML !== newText) totalDiv.innerHTML = newText;
			var newTip = generatePeoplePointsTooltipContent(releasePeoplePoints);
			if ($(totalDiv).data('powertip') !== newTip) $(totalDiv).data('powertip', newTip);
			
			releasePoints = 0;
			releasePeoplePoints = {};
			
		} else {
			var eClass = e.className;
			var estimateMatches = eClass.match(/estimate_\d{1,2}/);
			//window.console.log('e matches=' + estimateMatches);
			if (estimateMatches != null) {
				if (estimateMatches.length > 1) {
					window.console.log('W more than 1 estimate_?? class: ' + estimateMatches);
				}
				// extract the number from the estimate class, parse base 10, add to points
				var points = parseInt(estimateMatches[0].substring(9), 10);
				releasePoints += points;
				panelPoints += points;
				
				//var owner = _e.find('.owner').text();
				//addPeoplePoints(releasePeoplePoints, owner, points);
				//addPeoplePoints(panelPeoplePoints, owner, points);
				_e.find('.owner').each(function (i, e) {
					var owner = $(e).text();
					addPeoplePoints(releasePeoplePoints, owner, points);
					addPeoplePoints(panelPeoplePoints, owner, points);
				});
				
			}
		}
	});
	
	// display the total points of stories in the panel
	var ee = _panel.find('.panelSummary');
	var totalDiv;
	if (ee.length > 0) {
		totalDiv = ee[0];
	} else {
		var isWorkspace = _panel.find('.workspace_header').length > 0;
		var elementType = isWorkspace ? 'div' : 'h3';
		totalDiv = document.createElement(elementType);
		totalDiv.className = 'panelSummary';
		// enable powertip, content comes from data title
		$(totalDiv).powerTip(powerTipOptions);
		
		if (isWorkspace) {
			totalDiv.style.position = 'relative';
			totalDiv.style.float = 'right';
			_panel.find('.panel_header').find('.tracker_markup').append(totalDiv);
			
		} else {
			totalDiv.style.position = 'absolute';
			totalDiv.style.right = '0px';
			totalDiv.style.padding = '0px 3px';
			_panel.find('.controls').after(totalDiv);
		}
	}
	var newText = 'Pts: ' + panelPoints;
	if (totalDiv.innerHTML !== newText) totalDiv.innerHTML = newText;
	//$(totalDiv).data('powertip', generatePeoplePointsTooltipContent(panelPeoplePoints));
	var newTip = generatePeoplePointsTooltipContent(panelPeoplePoints);
	if ($(totalDiv).data('powertip') !== newTip) $(totalDiv).data('powertip', newTip);
}
function addPeoplePoints(peoplePoints, person, points) {
	var oldPoints = peoplePoints[person];
	if (oldPoints != undefined) {
		points += oldPoints;
	}
	peoplePoints[person] = points;
}
function generatePeoplePointsTooltipContent(peoplePoints) {
	var content = '';
	// sort people into new array
	var people = [];
	for (var person in peoplePoints) {
		// filter out prototype properties
		if (peoplePoints.hasOwnProperty(person)) {
			for (var i = 0; i <= people.length; i++) {
				if (i == people.length) {
					people.push(person);
					break;
				} else if (person < people[i]) {
					people.splice(i, 0, person);
					break;
				}
			}
		}
	}
	if (people.length == 0) return '';
	for (var i = 0; i < people.length; i++) {
		var person = people[i];
		if (peoplePoints.hasOwnProperty(person) && person.length > 0) {
			content += '<p style="color: ' + personColor(person) + ';">' + person +  ': ' + peoplePoints[person] + '</p>';
		}
	}
	content = '<div class="peopleSummaryTip">' + content + '</div>';
	return content;
}
// assign color based on ascii value of name
function personColor(initials) {
	var color = personColorMap[initials];
	if (color == undefined) {
		var g = colorFromAsciiCode(initials.charCodeAt(0));
		var b = initials.length > 1 ? colorFromAsciiCode(initials.charCodeAt(1)) : 255;
		var r = 255;
		if (initials.length > 2) {
			r = colorFromAsciiCode(initials.charCodeAt(2));
		} else if (initials.length > 1) {
			r = 255 - Math.floor(Math.abs(initials.charCodeAt(0) - initials.charCodeAt(1)) / 26 * 225);
		}
		color = 'rgb(' + r + ',' + g + ',' + b + ')';
		personColorMap[initials] = color;
	}
	return color;
}
function colorFromAsciiCode(code) {
	return 255 - Math.floor(((code - 65) / 26 * 225));
}

var modSerial = 0;
function handlePanelModified(ev) {
	if (logDebug) {
		var evMsg = 'null';
		if (ev != null) {
			//evMsg = 'target=' + ev.target.tagName;
			//if (ev.target.id != null) evMsg += '#' + ev.target.id;
			//if (ev.target.className != '') evMsg += '."' + ev.target.className
			//	+ '" curTarget.class="' + ev.currentTarget.className + '"';
			evMsg = 'target=' + elementLog(ev.target);
			evMsg += ' curTarget=' + elementLog(ev.currentTarget);
			var originalEvent = ev.originalEvent;
			if (ev.originalEvent.srcElement != null) {
				//evMsg += ' origEv.srcEl.class="' + ev.originalEvent.srcElement.className + '"';
				evMsg += ' origEv.srcEl=' + elementLog(ev.originalEvent.srcElement);
			}
		}
		modSerial++;
		window.console.log('handlePanelModified ' + modSerial + ' ' + evMsg);
	}
	
	scheduleUpdate(ev);
}
function elementLog(el) {
	var msg = 'null';
	if (el != null) {
		msg = el.tagName;
		if (el.id != null) msg += '#' + el.id;
		if (el.className != '') msg += '."' + el.className + '"';
	}
	return msg;
}
var timeoutId = -1;
function scheduleUpdate(ev) {
	//window.console.log('scheduleUpdate ' + new Date());
	// cancel existing timeout
	if (timeoutId != -1) {
		clearTimeout(timeoutId);
		timeoutId = -1;
	}
	// update totals after changes quiet down
	//timeoutId = setTimeout(updateTotals, 300);
	timeoutId = setTimeout(function() {
		//updateTotals(ev);
		displayReleaseTotals(ev);
	}, 300);
}
function updateTotals(ev) {
	window.console.log('updateTotals ' + new Date() + ' ev=' + ev);
}

//main();
// TODO listen for onload event, check document.readyState first
//setTimeout(main, 2000);
var originalLoad = window.onload;
window.console.log('document.readyState=' + document.readyState + ' onload=' + originalLoad);
//$(document).on('load', function() {
$(document).ready(function() {
	//if (originalLoad) originalLoad();
	setTimeout(main2, 4000);
	
	var countDiv = document.createElement('div');
	countDiv.id = 'sprintSummary';
	countDiv.innerText = 'load ext';
	countDiv.style.position = 'absolute';
	countDiv.style.left = '300px';
	countDiv.style.top = '0px';
	countDiv.style.padding = '3px';
	countDiv.style.background = 'white';
	//document.body.appendChild(countDiv);
	$(countDiv).click(main2);
});
