// timestudy.js - simple responsive timer for static site
/* Stopwatch with laps */
/* Multi-stopwatch (3) with hold-to-run per-button */
// Multi-sheet support: 5 sheets, each with 5 rows x 3 timers
(function(){
    const COUNT = 3;
    const ROWS = 5;
    const SHEETS = 5;
    let sheetIndex = 0; // current sheet (0-4)
    let activeRow = 0;
    let activeHoldCount = 0;
    // Each sheet has its own timers' elapsedPerRow arrays
    // sheetsData: [ { timers: [ { elapsedPerRow: [ms,...], ... }, ... ] }, ... ]
    let sheetsData = [];
    // timers: 3 timer objects, always operate on current sheet
    const timers = [];
    function lockScroll(){
        activeHoldCount++;
        if(activeHoldCount === 1) document.body.classList.add('no-scroll');
    }
    function unlockScroll(){
        activeHoldCount = Math.max(0, activeHoldCount-1);
        if(activeHoldCount === 0) document.body.classList.remove('no-scroll');
    }

    // Persistent storage helpers
    const STORAGE_KEY = 'timestudy_state_v2'; // bump version for multi-sheet
    let _initialized = false;
    // Detect whether localStorage is available (useful for diagnosis on hosted sites)
    function storageAvailable(){
        try{
            const testKey = '__timestudy_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            return true;
        }catch(e){
            return false;
        }
    }
    const _storageOk = storageAvailable();
    function saveState(){
        try{
            if(!_initialized) return;
            if(!_storageOk) {
                try{ console.warn('timestudy.saveState: localStorage unavailable'); }catch(e){}
                const statusEl = document.getElementById('save-status');
                if(statusEl) statusEl.textContent = '(storage unavailable)';
                return;
            }
            // Save all sheets' timer data
            const state = {
                sheetIndex,
                activeRow,
                sheetsData: sheetsData.map(sheet => ({
                    timers: sheet.timers.map(t => ({
                        elapsedPerRow: t.elapsedPerRow.slice(),
                        running: false, // do not persist running state across reloads
                        runningRow: null,
                        baseElapsed: 0,
                        startTimestamp: null
                    }))
                }))
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            const statusEl = document.getElementById('save-status');
            try{ console.debug('timestudy.saveState saved', { key: STORAGE_KEY, size: (localStorage.getItem(STORAGE_KEY)||'').length }); }catch(e){}
        }catch(err){ /* ignore */ }
    }
    function loadState(){
        try{
            if(!_storageOk) {
                try{ console.warn('timestudy.loadState: localStorage unavailable'); }catch(e){}
                return null;
            }
            const raw = localStorage.getItem(STORAGE_KEY);
            try{ console.debug('timestudy.loadState read', { key: STORAGE_KEY, size: raw ? raw.length : 0 }); }catch(e){}
            if(!raw) return null;
            return JSON.parse(raw);
        }catch(err){ return null; }
    }

    function formatMs(ms){
        const total = Math.floor(ms/10); // centiseconds
        const cs = total % 100;
        const s = Math.floor(total/100) % 60;
        const m = Math.floor(total/6000);
        return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '.' + String(cs).padStart(2,'0');
    }

    function createTimer(index){
        const display = null;
        const holdBtn = document.getElementById('hold-' + index);
        const lapBtn = null;
        const resetBtn = null;
        const lapsBody = document.querySelector('#laps-table-' + index + ' tbody');
        // elapsedPerRow is always a reference to the current sheet's timer data
        const t = {
            index,
            display,
            holdBtn,
            lapBtn,
            resetBtn,
            lapsBody,
            startTime: 0,
            elapsedPerRow: null, // will be set on sheet switch
            runningRow: null,
            baseElapsed: 0,
            running: false,
            rafId: null,
            laps: []
        };

        function render(){
            let formatted = '00:00.00';
            if(t.running){
                const now = performance.now() - t.startTime + t.baseElapsed;
                formatted = formatMs(now);
                // update the cell for the row this timer is currently recording
                const sheetCell = document.getElementById('sheet-r' + t.runningRow + '-c' + t.index);
                if(sheetCell) {
                    sheetCell.textContent = formatted;
                    sheetCell.classList.add('timer-running-cell');
                }
            } else {
                // when not running, show the stored value for the currently selected row
                const sheetCell = document.getElementById('sheet-r' + activeRow + '-c' + t.index);
                if(sheetCell && t.elapsedPerRow) {
                    sheetCell.textContent = formatMs(t.elapsedPerRow[activeRow] || 0);
                    sheetCell.classList.remove('timer-running-cell');
                }
            }
            t.rafId = requestAnimationFrame(render);
        }

        function start(){
            if(t.running) return;
            // start recording into the current activeRow independently
            t.runningRow = activeRow;
            t.baseElapsed = t.elapsedPerRow[t.runningRow] || 0;
            t.startTime = performance.now();
            t.running = true;
            t.holdBtn.classList.add('running');
            // Set the cell background to green when timer starts
            const sheetCell = document.getElementById('sheet-r' + t.runningRow + '-c' + t.index);
            if(sheetCell) sheetCell.classList.add('timer-running-cell');
            t.rafId = requestAnimationFrame(render);
            saveState();
        }

        function stop(){
            if(!t.running) return;
            const elapsed = performance.now() - t.startTime + t.baseElapsed;
            // persist into the row that was being recorded
            if(typeof t.runningRow === 'number'){
                t.elapsedPerRow[t.runningRow] = elapsed;
                const sheetCell = document.getElementById('sheet-r' + t.runningRow + '-c' + t.index);
                if(sheetCell) {
                    sheetCell.textContent = formatMs(elapsed);
                    sheetCell.classList.remove('timer-running-cell');
                }
            }
            t.running = false;
            t.runningRow = null;
            t.baseElapsed = 0;
            t.holdBtn.classList.remove('running');
            if(t.rafId) cancelAnimationFrame(t.rafId);
            t.rafId = null;
            saveState();
        }

        function reset(){
            t.running = false;
            t.startTime = 0;
            if(t.elapsedPerRow) {
                for(let i=0;i<ROWS;i++) t.elapsedPerRow[i] = 0;
            }
            t.runningRow = null;
            t.baseElapsed = 0;
            t.laps.length = 0;
            t.holdBtn.classList.remove('running');
            if(t.rafId) cancelAnimationFrame(t.rafId);
            t.rafId = null;
            // clear all sheet cells for this timer
            for(let r=0;r<ROWS;r++){
                const cell = document.getElementById('sheet-r'+r+'-c'+t.index);
                if(cell) cell.textContent = '00:00.00';
            }
            renderLaps();
            saveState();
        }

        function lap(){
            const now = t.running ? (performance.now() - t.startTime + t.elapsed) : t.elapsed;
            const lastTotal = t.laps.length ? t.laps.reduce((a,b)=>a+b,0) : 0;
            const lapTime = now - lastTotal;
            t.laps.push(lapTime);
            renderLaps();
        }

        function renderLaps(){
            t.lapsBody.innerHTML = '';
            for(let i=0;i<t.laps.length;i++){
                const tr = document.createElement('tr');
                const tdLap = document.createElement('td');
                tdLap.textContent = formatMs(t.laps[i]);
                tr.appendChild(tdLap);
                t.lapsBody.appendChild(tr);
            }
        }

        // Events for hold-to-run using Pointer Events per-button with pointer capture.
        // This prevents a global mouseup/touchend from stopping other timers.
    let holdActive = false;
        let activePointerId = null;
        function onHoldStart(e){
            // prefer pointer events; prevent default to avoid touch->mouse emulation
            e.preventDefault();
            holdActive = true;
            activePointerId = (e.pointerId !== undefined) ? e.pointerId : null;
            try{ if(activePointerId !== null) t.holdBtn.setPointerCapture(activePointerId); }catch(err){}
            lockScroll();
            start();
        }
        function onHoldEnd(e){
            // if event has a pointerId ensure it matches our active pointer
            if(e && e.pointerId !== undefined && activePointerId !== null && e.pointerId !== activePointerId){
                return;
            }
            e && e.preventDefault();
            if(!holdActive) return;
            holdActive = false;
            activePointerId = null;
            try{ if(e && e.pointerId !== undefined) t.holdBtn.releasePointerCapture(e.pointerId); }catch(err){}
            stop();
            unlockScroll();
        }

        // Use pointer events on the button so multiple buttons can be pressed simultaneously
        t.holdBtn.addEventListener('pointerdown', onHoldStart, {passive:false});
        t.holdBtn.addEventListener('pointerup', onHoldEnd);
        t.holdBtn.addEventListener('pointercancel', onHoldEnd);

        // keyboard accessibility (space/enter to toggle hold)
        t.holdBtn.addEventListener('keydown', (ev)=>{
            if(ev.code === 'Space' || ev.code === 'Enter'){
                ev.preventDefault();
                onHoldStart(ev);
            }
        });
        t.holdBtn.addEventListener('keyup', (ev)=>{
            if(ev.code === 'Space' || ev.code === 'Enter'){
                ev.preventDefault();
                onHoldEnd(ev);
            }
        });

    // per-timer buttons removed; lap/reset triggered only programmatically

        // initialize
        reset();

        // expose render so external restore logic can restart RAF loops
        t.render = render;

        // when timers created, render any activeRow cell if needed
        // (sheet will be updated by global selection handler)

        t.reset = reset; // expose reset for global reset
    return t;
    }

    // Create timers (shared, always 3, but their elapsedPerRow is swapped on sheet switch)
    for(let i=0;i<COUNT;i++){
        timers.push(createTimer(i));
    }

    // --- Multi-sheet logic ---
    function ensureSheetsData(){
        if(!Array.isArray(sheetsData) || sheetsData.length !== SHEETS){
            sheetsData = [];
            for(let s=0;s<SHEETS;s++){
                sheetsData.push({
                    timers: Array.from({length:COUNT},()=>({elapsedPerRow:new Array(ROWS).fill(0)}))
                });
            }
        }
    }

    function switchSheet(newSheetIdx){
        if(newSheetIdx === sheetIndex) return;
        // Stop all timers before switching
        timers.forEach(t=>{ if(t.running) t.stop && t.stop(); });
        sheetIndex = newSheetIdx;
        // Update timers' elapsedPerRow reference to the new sheet
        for(let i=0;i<COUNT;i++){
            timers[i].elapsedPerRow = sheetsData[sheetIndex].timers[i].elapsedPerRow;
        }
        // Update table UI
        for(let r=0;r<ROWS;r++){
            for(let ti=0;ti<COUNT;ti++){
                const cell = document.getElementById('sheet-r'+r+'-c'+ti);
                if(cell) cell.textContent = formatMs(timers[ti].elapsedPerRow[r] || 0);
            }
        }
        // Update tab UI
        const tabBtns = document.querySelectorAll('.sheet-tab');
        tabBtns.forEach((btn, idx)=>{
            if(idx === sheetIndex){
                btn.setAttribute('aria-selected','true');
                btn.classList.add('active');
            }else{
                btn.setAttribute('aria-selected','false');
                btn.classList.remove('active');
            }
        });
        saveState();
    }

        // Attempt to restore saved state (elapsedPerRow, activeRow, running timers)
        (function(){
            ensureSheetsData();
            const saved = loadState();
            if(saved && Array.isArray(saved.sheetsData) && saved.sheetsData.length === SHEETS){
                // Restore all sheets
                sheetsData = saved.sheetsData.map(sheet => ({
                    timers: sheet.timers.map(t => ({
                        elapsedPerRow: (Array.isArray(t.elapsedPerRow) && t.elapsedPerRow.length === ROWS) ? t.elapsedPerRow.slice() : new Array(ROWS).fill(0)
                    }))
                }));
                sheetIndex = typeof saved.sheetIndex === 'number' ? Math.max(0, Math.min(SHEETS-1, saved.sheetIndex)) : 0;
                activeRow = typeof saved.activeRow === 'number' ? Math.max(0, Math.min(ROWS-1, saved.activeRow)) : 0;
            } else {
                ensureSheetsData();
                sheetIndex = 0;
                activeRow = 0;
            }
            // Set timers' elapsedPerRow to current sheet
            for(let i=0;i<COUNT;i++){
                timers[i].elapsedPerRow = sheetsData[sheetIndex].timers[i].elapsedPerRow;
            }
            // Update table UI
            for(let r=0;r<ROWS;r++){
                for(let ti=0;ti<COUNT;ti++){
                    const cell = document.getElementById('sheet-r'+r+'-c'+ti);
                    if(cell) cell.textContent = formatMs(timers[ti].elapsedPerRow[r] || 0);
                }
            }
            // Update tab UI
            setTimeout(()=>{
                const tabBtns = document.querySelectorAll('.sheet-tab');
                tabBtns.forEach((btn, idx)=>{
                    if(idx === sheetIndex){
                        btn.setAttribute('aria-selected','true');
                        btn.classList.add('active');
                    }else{
                        btn.setAttribute('aria-selected','false');
                        btn.classList.remove('active');
                    }
                });
            }, 0);
            _initialized = true;
            try{
                saveState();
            }catch(e){}
        })();

    // Row selection handlers
    function setActiveRow(r){
        if(r<0||r>=ROWS) return;
        // remove highlight from old
        const prev = document.getElementById('sheet-row-'+activeRow);
        if(prev) prev.classList.remove('active-row');
        activeRow = r;
        const row = document.getElementById('sheet-row-'+activeRow);
        if(row) row.classList.add('active-row');
        // update visible cells from timers' stored elapsedPerRow
        for(let ti=0;ti<COUNT;ti++){
            const cell = document.getElementById('sheet-r'+activeRow+'-c'+ti);
            if(cell) cell.textContent = formatMs(timers[ti].elapsedPerRow[activeRow] || 0);
        }
        saveState();
    }

    // attach click/touch handlers to each row
    for(let r=0;r<ROWS;r++){
        const rowEl = document.getElementById('sheet-row-'+r);
        if(!rowEl) continue;
        rowEl.addEventListener('click', ()=> setActiveRow(r));
        rowEl.addEventListener('touchend', (e)=>{ e.preventDefault(); setActiveRow(r); }, {passive:false});
    }
    // attach tab bar handlers
    const tabBtns = document.querySelectorAll('.sheet-tab');
    tabBtns.forEach((btn, idx)=>{
        btn.addEventListener('click', ()=> switchSheet(idx));
        btn.addEventListener('touchend', (e)=>{ e.preventDefault(); switchSheet(idx); }, {passive:false});
    });

    // set initial active row
    setActiveRow(activeRow);

    // Reset This Trial button (resets only current sheet, with confirmation)
    const resetThisTrialBtn = document.getElementById('reset-this-trial');
    if(resetThisTrialBtn){
        const doResetThisTrial = ()=>{
            if(!window.confirm('Are you sure you want to reset this trial? This cannot be undone.')) return;
            timers.forEach(t=>{
                if(typeof t.reset === 'function') t.reset();
            });
            saveState();
        };
        resetThisTrialBtn.addEventListener('click', doResetThisTrial);
        resetThisTrialBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); doResetThisTrial(); }, {passive:false});
    }

    // Reset All Trials button (resets all sheets, with confirmation)
    const resetAllTrialsBtn = document.getElementById('reset-all-trials');
    if(resetAllTrialsBtn){
        const doResetAllTrials = ()=>{
            if(!window.confirm('Are you sure you want to reset ALL trials? This will delete the entire time study and cannot be undone.')) return;
            // For each sheet, reset all timer values
            for(let s=0; s<SHEETS; s++){
                for(let t=0; t<COUNT; t++){
                    for(let r=0; r<ROWS; r++){
                        sheetsData[s].timers[t].elapsedPerRow[r] = 0;
                    }
                }
            }
            // After reset, update current timers and UI
            for(let t=0; t<COUNT; t++){
                if(typeof timers[t].reset === 'function') timers[t].reset();
            }
            saveState();
        };
        resetAllTrialsBtn.addEventListener('click', doResetAllTrials);
        resetAllTrialsBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); doResetAllTrials(); }, {passive:false});
    }

    // Export state as CSV (all trials/tabs, nicely formatted for Excel)
    const exportBtn = document.getElementById('export-state');
    if(exportBtn){
        exportBtn.addEventListener('click', ()=>{
            try{
                // Build CSV header for all trials
                const headers = ['Trial', 'Step', 'VA (sec)', 'NVA (sec)', 'Walk (sec)'];
                const rows = [headers];
                for(let s=0; s<SHEETS; s++){
                    if(s > 0) rows.push(['', '', '', '', '']); // blank row between trials
                    for(let r=0; r<ROWS; r++){
                        const row = [`Trial ${s+1}`, String(r+1)];
                        for(let ti=0; ti<COUNT; ti++){
                            let ms = sheetsData[s].timers[ti].elapsedPerRow[r] || 0;
                            // output seconds as decimal with two fraction digits
                            const seconds = (ms/1000);
                            row.push(typeof seconds === 'number' ? seconds.toFixed(2) : '0.00');
                        }
                        rows.push(row);
                    }
                }
                // Convert rows to CSV string (comma-separated, values quoted if needed)
                function csvEscape(val){
                    if(val == null) return '';
                    const s = String(val);
                    if(s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1){
                        return '"' + s.replace(/"/g, '""') + '"';
                    }
                    return s;
                }
                const csv = rows.map(r=> r.map(csvEscape).join(',')).join('\r\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                // Get the filename from the input field, fallback to default
                let filename = '';
                const input = document.getElementById('csv-title');
                if(input && input.value.trim()) {
                    let name = input.value.trim();
                    // Remove illegal filename characters
                    name = name.replace(/[^a-zA-Z0-9-_ ]/g, '');
                    if(!name.toLowerCase().endsWith('.csv')) name += '.csv';
                    filename = name;
                } else {
                    let promptName = window.prompt('Please enter a name for the CSV file:', '');
                    if(promptName && promptName.trim()) {
                        promptName = promptName.trim().replace(/[^a-zA-Z0-9-_ ]/g, '');
                        if(!promptName.toLowerCase().endsWith('.csv')) promptName += '.csv';
                        filename = promptName;
                    } else {
                        filename = 'time_study.csv';
                    }
                }
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            }catch(err){ console.error('CSV export failed', err); }
        });
    }

    // save state on unload as a final safeguard
    window.addEventListener('beforeunload', ()=>{ try{ saveState(); }catch(e){} });

})();
