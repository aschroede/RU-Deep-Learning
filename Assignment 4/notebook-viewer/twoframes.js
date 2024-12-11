
// returns [[idxA, idxB], ...] pairs
function findOptimalPairing(seqA, seqB) {
  // find the best pairing between sequences,
  // based on the Levenshtein distance/Wagner-Fisher algorithm
  // see pseudocode on Wikipedia
  // https://en.wikipedia.org/wiki/Wagner%E2%80%93Fischer_algorithm

  let d = []
  for (let i=0; i<=seqA.length; i++) {
    let d_i = [];
    for (let j=0; j<=seqB.length; j++) {
      d_i.push(0);
    }
    d.push(d_i);
  }

  // source prefixes can be transformed into empty string by
  // dropping all characters
  for (let i=1; i<=seqA.length; i++) {
      d[i][0] = i;
  }

  // target prefixes can be reached from empty source prefix
  // by inserting every character
  for (let j=1; j<=seqB.length; j++) {
      d[0][j] = j;
  }

  // fill the matrix
  for (let j=1; j<=seqB.length; j++) {
    for (let i=1; i<=seqA.length; i++) {
      let substitutionCost = (seqA[i - 1] == seqB[j - 1]) ? 0 : 1;
      d[i][j] = Math.min(
        d[i-1][j] + 1,                    // deletion
        d[i][j-1] + 1,                    // insertion
        d[i-1][j-1] + substitutionCost    // substitutioncost
      );
    }
  }

  // backtrack to find the optimal order of operations
  // loosely based on https://stackoverflow.com/a/50864452
  let i = seqA.length;
  let j = seqB.length;
  let pairs = [];
  while (i > 0 || j > 0) {
    if (j == 0) {
      // only seqA left
      pairs.unshift([i - 1, null]);
      i -= 1;
      continue;
    }
    if (i == 0) {
      // only seqB left
      pairs.unshift([null, j - 1]);
      j -= 1;
      continue;
    }

    let cur = d[i][j];
    let left = d[i][j-1];
    let up = d[i-1][j];
    let diag = d[i-1][j-1];
    if ((diag <= left && diag <= up) && (diag == cur - 1 || diag == cur)) {
      // match seqA and seqB
      pairs.unshift([i - 1, j - 1]);
      i -= 1;
      j -= 1;
    } else if (left <= diag && left == cur - 1) {
      // from seqB only
      pairs.unshift([null, j - 1]);
      j -= 1;
    } else {
      // from seqA only
      pairs.unshift([i - 1, null]);
      i -= 1;
    }
  }

  // edit distance
  // d[seqA.length - 1][seqB.length - 1];
  // paired indices
  return pairs;
}


class Event {
  constructor(src) {
    this.src = src;
    this.listeners = [];
  }
  addListener(listener) {
    this.listeners.push(listener);
  }
  trigger(arg) {
    for (const listener of this.listeners) {
      listener(this, arg);
    }
  }
}


// synchronizes scrolling between iframes
class ScrollManager {
  constructor(iframes) {
    this.nowScrolling = null;
    this.nowScrollingTimeout = null;

    this.iframes = iframes;

    for (const iframe of iframes) {
      iframe.onLoad.addListener(this.handleIframeLoad.bind(this));
      iframe.onScroll.addListener(this.handleIframeScroll.bind(this));
    }
  }

  handleIframeLoad(evt) {
    // after loading, try to take the scrolling position from another iframe
    let iframe = evt.src;
    for (const other of this.iframes) {
      if (other != iframe) {
        window.setTimeout(() => { this.scrollFrom(other); }, 1000);
        return;
      }
    }
  }

  handleIframeScroll(evt) {
    // scroll to the position of this iframe
    this.scrollFrom(evt.src);
  }

  scrollFrom(iframe) {
    // take the scroll position from iframe
    if (this.nowScrolling && iframe != this.nowScrolling) {
      // already scrolling from the other frame, skip event
      return;
    }

    this.setNowScrolling(iframe);

    // scroll other iframes to the same position
    for (const other of this.iframes) {
      if (other != iframe) {
        other.scrollTo(iframe.scrollY);
      }
    }
  }

  // to prevent loops, we only handle scroll events from one side at a time
  // set the active scrolling pane, and a timer to reset it
  setNowScrolling(iframe) {
    this.nowScrolling = iframe;
    if (this.nowScrollingTimeout) {
      window.clearTimeout(this.nowScrollingTimeout);
    }
    if (iframe != null) {
      this.nowScrollingTimeout = window.setTimeout(this.resetNowScrolling.bind(this), 200);
    }
  }
  resetNowScrolling() {
    this.setNowScrolling(null);
  }
}


// synchronizes the height of sections between iframes
class SyncHeightsManager {
  constructor(iframes) {
    this.iframes = iframes;

    for (const iframe of iframes) {
      iframe.onLoad.addListener(this.triggerSyncs.bind(this));
    }

    window.addEventListener('resize', this.sync.bind(this));
  }

  // mathjax takes a while to resize elements,
  // so we update the heights after a little while
  triggerSyncs() {
    let sync = this.sync.bind(this);
    window.setTimeout(sync, 1000);
    window.setTimeout(sync, 2000);
    window.setTimeout(sync, 3000);
    window.setTimeout(sync, 5000);
    this.sync();
  }

  // synchronise the height of each section pair in both notebooks
  sync() {
    let syncables = [];
    for (const iframe of this.iframes) {
      if (iframe.cellGroups) {
        syncables.push(iframe.cellGroups);
      }
    }
    if (syncables.length == 0) {
      return;
    }

    let pairs;
    if (syncables.length == 2) {
      // fancy pairing:
      // pair the sections in the most efficient way, based on the content
      pairs = findOptimalPairing(syncables[0].sectionKeys,
                                 syncables[1].sectionKeys);

    } else {
      // simple pairing: sequentially
      // find the number of sections in the longest notebook
      let numGroups = Math.max(...syncables.map((s) => s.sections.length));
      pairs = [];
      for (let i=0; i<numGroups; i++) {
        let pair = [];
        for (let s of syncables) {
          if (i < s.sections.length) {
            // still sections left
            pair.push(i);
          } else {
            // reached end of this syncable
            pair.push(null);
          }
        }
        pairs.push(pair);
      }
    }

    // find the maximum height of each row
    let rowHeights = [];
    for (let i=0; i<pairs.length; i++) {
      let maxHeight = 0;
      for (let j=0; j<pairs[i].length; j++) {
        let s = syncables[j];
        let idx = pairs[i][j];
        if (idx != null) {
          // the section contains one div,
          // we measure the height of this as the height of the content
          // +1 because the offsetHeight may be rounded down
          let h = s.sections[idx].firstChild.offsetHeight + 1;
          if (h > maxHeight) {
            maxHeight = h;
          }
        }
      }
      rowHeights[i] = maxHeight;
    }

    // set the heights in each iframe
    for (let j=0; j<syncables.length; j++) {
      let s = syncables[j];
      let cumHeight = 0;
      let curSection = null;
      for (let i=0; i<pairs.length; i++) {
        // sections can belong to multiple rows,
        // so we accumulate the heights
        if (pairs[i][j] != null) {
          if (curSection != null) {
            // start of a new section, assign the accumulated height
            // to the previous section
            s.sections[curSection].style.minHeight = cumHeight + 'px';
            // reset cumulative height
            cumHeight = 0;
          }
          curSection = pairs[i][j];
        }
        // add row height to current section
        cumHeight += rowHeights[i];
      }
      if (curSection != null) {
        // final section
        s.sections[curSection].style.minHeight = cumHeight + 'px';
      }
    }

    console.log('Synced ' + pairs.length + ' groups in ' + syncables.length + ' frames.');
  }
}


// groups the cells in a notebook in a number of sections,
// split on headings and questions
class AssignmentCellGroups {
  constructor(iframe) {
    this.iframe = iframe;
    this.addStyle();
    this.makeGroups();
  }

  // group cells based on isSyncableCell,
  // move them to new <section> containers in the document
  makeGroups() {
    let doc = this.iframe.contentDocument;
    let section = [];
    let sections = [section];

    let body = doc.body;
    let main = doc.getElementsByTagName("main");
    if (main.length == 1) {
        // new versions of nbconvert use a <main> tag
        body = main[0];
    }

    // group cells, split at each heading
    let cell = body.firstChild;
    while (cell) {
      let syncKey = this.computeSyncKey(cell);
      if (syncKey != null) {
        if (section.length > 0) {
          section = [];
          sections.push(section);
          section.syncKey = syncKey;
        }
      }
      let nextCell = cell.nextSibling;
      section.push(cell);
      cell = nextCell;
    }

    // move cells to a <section> per group
    let htmlSections = [];
    for (let i=0; i<sections.length; i++) {
      if (sections[i].length > 0) {
        let section = doc.createElement('section');
        section.className = 'cell-group';
        // wrap the contents in a single div,
        // which is used to measure the height
        let div = doc.createElement('div');
        section.appendChild(div);
        for (let j=0; j<sections[i].length; j++) {
          div.appendChild(sections[i][j]);
        }
        body.appendChild(section);
        section.syncKey = sections[i].syncKey;
        htmlSections.push(section);
      }
    }

    this.sections = htmlSections;
    this.sectionKeys = htmlSections.map((s) => s.syncKey);
  }

  // group cells in sections, starting a new section for every h2/h3,
  // and for each question with points
  computeSyncKey(cell) {
    if (!cell.getElementsByTagName)
      return null;

    let textOnly = function(el) {
      // return content of text nodes that are direct children of el
      let n = el.firstChild;
      let t = [];
      while (n) {
        if (n.nodeType === Node.TEXT_NODE) {
          t.push(n.textContent);
        }
        n = n.nextSibling;
      }
      return t.join('');
    }

    // look for h2 and h3 headings in this cell
    if (cell.getElementsByTagName('h2').length > 0) {
      return textOnly(cell.getElementsByTagName('h2')[0]).trim();
    }
    if (cell.getElementsByTagName('h3').length > 0) {
      return textOnly(cell.getElementsByTagName('h3')[0]).trim();
    }

    // see if there are any questions in this cell
    let spans = cell.getElementsByTagName('span');
    for (let i=0; i<spans.length; i++) {
      if (spans[i].innerHTML.match(/^\s*\([0-9]+ points?\)\s*$/)) {
        return textOnly(spans[i].parentNode).trim();
      }
    }

    return null;
  }

  // add a line at the top of each paired section
  addStyle() {
    let styleSheet = this.iframe.contentDocument.createElement('style');
    styleSheet.innerText = '.cell-group > div { box-sizing: border-box; border-top: 1px solid #aaa; padding: 10px 0; } pre { overflow-x: auto }';
    this.iframe.contentDocument.head.appendChild(styleSheet);
  }
}


// an iframe with a notebook
class AssignmentIframe {
  constructor(iframe, scrollManager) {
    this.id = iframe.id;
    this.iframe = iframe;
    this.onLoad = new Event(this);
    this.onScroll = new Event(this);
    this.onAssignmentUpdate = new Event(this);

    this.cellGroups = null;
    this.loading = false;
    this.iframe.addEventListener('load', this.handleIframeLoad.bind(this));
  }

  loadNotebook(url) {
    this.cellGroups = null;
    this.iframe.src = 'about:blank';
    this.iframe.src = url;
    this.loading = true;
  }

  get ready() {
    return !this.loading
  }

  get scrollY() {
    return this.iframe.contentWindow.scrollY;
  }
  scrollTo(y) {
    if (this.iframe.contentWindow && this.iframe.contentWindow.scrollTo) {
      this.iframe.contentWindow.scrollTo({ top: y, left: 0 });
    }
  }

  handleIframeLoad() {
    console.log('onload event for iframe ' + this.id);

    // register the scroll handler for the new contentWindow
    this.iframe.contentWindow.addEventListener('scroll',
      () => { this.onScroll.trigger(); });

    // enable the upload button, if available
    if (this.iframe.contentWindow.enableScoreFileUpload) {
      this.iframe.contentWindow.enableScoreFileUpload();
    }

    // listen to assignment updates, if available
    if (this.iframe.contentWindow.assignment &&
        this.iframe.contentWindow.assignment.onUpdate) {
      this.iframe.contentWindow.assignment.onUpdate.addListener(this.handleAssignmentUpdate.bind(this));
    }

    // reset local store, if enabled
    if (this.iframe.contentWindow.assignment &&
        this.iframe.contentWindow.assignment.reset()) {
      this.iframe.contentWindow.assignment.reset();
    }

    // group cells in related sections
    this.cellGroups = new AssignmentCellGroups(this.iframe);

    this.loading = false;
    this.onLoad.trigger();
  }

  handleAssignmentUpdate() {
    if (this.iframe.contentWindow.assignment) {
      this.onAssignmentUpdate.trigger();
    }
  }
  get isAssignmentComplete() {
    return this.iframe.contentWindow.assignment && this.iframe.contentWindow.assignment.isComplete;
  }
  get isAssignmentCompleteSupported() {
    return this.iframe.contentWindow.assignment &&
           this.iframe.contentWindow.assignment.onUpdate;
  }

  loadScoreFile(yaml, compare) {
    if (this.isLoadScoreFileSupported) {
      this.iframe.contentWindow.scoreFileUpload.loadFromYaml(yaml, compare);
    }
  }
  get isLoadScoreFileSupported() {
    return this.iframe.contentWindow && this.iframe.contentWindow.scoreFileUpload &&
           this.iframe.contentWindow.scoreFileUpload.loadFromYamlForComparison;
  }

  downloadScoreFile() {
    if (this.isDownloadScoreFileSupported) {
      let links = this.iframe.contentDocument.getElementsByClassName('asgn-download-link');
      if (links.length == 1) {
        links[0].click();
      }
    }
  }
  get isDownloadScoreFileSupported () {
    return this.iframe.contentDocument &&
           this.iframe.contentDocument.getElementsByClassName('asgn-download-link').length == 1;
  }
}


class DropFileUploadButton {
  constructor(element) {
    this.onFileUpload = new Event(this);
    this.element = element;

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.addEventListener('change', this.handleFileChange.bind(this));

    this.element = element;
    this.element.addEventListener('click', () => { this.fileInput.click(); });
    this.element.addEventListener('drop', this.handleFileDrop.bind(this));
    this.element.addEventListener('dragenter', () => { this.element.classList.add('dragging'); });
    this.element.addEventListener('dragover', (evt) => { evt.preventDefault(); });
    this.element.addEventListener('dragleave', () => { this.element.classList.remove('dragging'); });
    this.element.addEventListener('dragend', () => { this.element.classList.remove('dragging'); });

    this.enabled = false;
  }

  set enabled(t) {
    this.element.classList.toggle('disabled', !t);
  }

  handleFileChange(evt) {
    let files = this.fileInput.files;
    if (files.length > 0) {
      this.handleFileUpload(files[0]);
    }
  }
  handleFileDrop(evt) {
    this.element.classList.remove('dragging');
    evt.preventDefault();

    if (evt.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      [...evt.dataTransfer.items].forEach((item, i) => {
        // If dropped items aren't files, reject them
        if (item.kind === 'file') {
          const file = item.getAsFile();
          this.handleFileUpload(file);
        }
      });
    } else {
      // Use DataTransfer interface to access the file(s)
      [...evt.dataTransfer.files].forEach((file, i) => {
        this.handleFileUpload(file);
      });
    }
  }
  handleFileUpload(file) {
    let reader = new FileReader();
    reader.addEventListener('load', () => {
      let txt = reader.result;
      this.onFileUpload.trigger(txt);
    });
    reader.readAsText(file);
  }
}


// the file dropdown and reload button
class IframeControls {
  constructor(iframe, head) {
    this.iframe = iframe;

    // select a file to view
    let select = head.getElementsByTagName('select')[0];
    let reloadBtn = head.getElementsByClassName('btn-reload')[0];
    select.addEventListener('change', () => { iframe.loadNotebook(select.value); });
    reloadBtn.addEventListener('click', () => { iframe.loadNotebook(select.value); });

    // download score file
    this.downloadBtn = head.getElementsByClassName('btn-download')[0];
    this.downloadBtn.addEventListener('click', () => { this.iframe.downloadScoreFile(); });

    // load a score file
    this.loadBtn = new DropFileUploadButton(head.getElementsByClassName('btn-load-scores')[0]);
    this.loadBtn.onFileUpload.addListener((src, txt) => { this.iframe.loadScoreFile(txt, false); });

    // load a score file for comparison
    this.compareBtn = new DropFileUploadButton(head.getElementsByClassName('btn-compare-scores')[0]);
    this.compareBtn.onFileUpload.addListener((src, txt) => { this.iframe.loadScoreFile(txt, true); });

    // update button states
    this.iframe.onLoad.addListener(this.handleIframeLoad.bind(this));
    this.iframe.onAssignmentUpdate.addListener(this.handleAssignmentUpdate.bind(this));
    this.handleIframeLoad();
  }

  handleIframeLoad() {
    let supported = this.iframe.isAssignmentCompleteSupported && this.iframe.isDownloadScoreFileSupported;
    this.downloadBtn.classList.toggle('disabled', !supported);

    supported = this.iframe.isLoadScoreFileSupported;
    this.compareBtn.enabled = supported;
    this.loadBtn.enabled = supported;
  }
  handleAssignmentUpdate() {
    this.downloadBtn.classList.toggle('ok', this.iframe.isAssignmentComplete);
  }
}


let ifLeft = new AssignmentIframe(document.getElementById('iframe-left'));
let ifRight = new AssignmentIframe(document.getElementById('iframe-right'));
let scrollManager = new ScrollManager([ifLeft, ifRight]);
let syncHeightsManager = new SyncHeightsManager([ifLeft, ifRight]);

new IframeControls(ifLeft, document.getElementById('head-left'));
new IframeControls(ifRight, document.getElementById('head-right'));

