// timestudy.js - simple responsive timer for static site
/* Stopwatch with laps */
/* Multi-stopwatch (3) with hold-to-run per-button */
(function(){
    const COUNT = 3;
    const ROWS = 5; // number of steps/rows
    const timers = [];
    let activeRow = 0; // selected step (0-based)
    let activeHoldCount = 0;
    function lockScroll(){
        activeHoldCount++;
        if(activeHoldCount === 1) document.body.classList.add('no-scroll');
    }
    function unlockScroll(){
        activeHoldCount = Math.max(0, activeHoldCount-1);
        if(activeHoldCount === 0) document.body.classList.remove('no-scroll');
    }

    // Persistent storage helpers
    const STORAGE_KEY = 'timestudy_state_v1';
    function saveState(){
        try{
            const state = { activeRow, timers: timers.map(t=>({ elapsedPerRow: t.elapsedPerRow, running: t.running, runningRow: t.runningRow, baseElapsed: t.baseElapsed, startTimestamp: t.running ? Date.now() - (performance.now() - t.startTime) : null })) };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            const statusEl = document.getElementById('save-status');
            if(statusEl) statusEl.textContent = '(saved)';
            try{ console.debug('timestudy.saveState saved', { key: STORAGE_KEY, size: (localStorage.getItem(STORAGE_KEY)||'').length }); }catch(e){}
        }catch(err){ /* ignore */ }
    }
    function loadState(){
        try{
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
    // per-timer display removed; only top sheet cells are used
    const display = null;
    const holdBtn = document.getElementById('hold-' + index);
    // per-timer lap and reset buttons removed from markup
    const lapBtn = null;
    const resetBtn = null;
        const lapsBody = document.querySelector('#laps-table-' + index + ' tbody');

        // store elapsed per-row so switching rows preserves values
        const t = {
            index,
            display,
            holdBtn,
            lapBtn,
            resetBtn,
            lapsBody,
            startTime: 0,
            // elapsedPerRow holds elapsed ms for each row
            elapsedPerRow: new Array(ROWS).fill(0),
            // when running, which row is being recorded
            runningRow: null,
            // base elapsed when starting (the stored value for runningRow)
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
                if(sheetCell) sheetCell.textContent = formatted;
            } else {
                // when not running, show the stored value for the currently selected row
                const sheetCell = document.getElementById('sheet-r' + activeRow + '-c' + t.index);
                if(sheetCell) sheetCell.textContent = formatMs(t.elapsedPerRow[activeRow] || 0);
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
                if(sheetCell) sheetCell.textContent = formatMs(elapsed);
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
            t.elapsedPerRow = new Array(ROWS).fill(0);
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

    // Create timers
    for(let i=0;i<COUNT;i++){
        timers.push(createTimer(i));
    }

        // Attempt to restore saved state (elapsedPerRow, activeRow, running timers)
        (function(){
            const saved = loadState();
            if(!saved || !saved.timers) {
                const statusEl = document.getElementById('save-status');
                if(statusEl) statusEl.textContent = '(no saved state)';
                return;
            }
            try{
                if(typeof saved.activeRow === 'number') activeRow = Math.max(0, Math.min(ROWS-1, saved.activeRow));
                for(let i=0;i<COUNT;i++){
                    const s = saved.timers[i];
                    const t = timers[i];
                    if(!t || !s) continue;
                    // restore elapsedPerRow (ensure proper length)
                    if(Array.isArray(s.elapsedPerRow)){
                        const arr = new Array(ROWS).fill(0);
                        for(let r=0;r<Math.min(ROWS, s.elapsedPerRow.length); r++) arr[r] = s.elapsedPerRow[r] || 0;
                        t.elapsedPerRow = arr;
                    }
                    // restore baseElapsed and runningRow
                    t.baseElapsed = s.baseElapsed || 0;
                    t.runningRow = (typeof s.runningRow === 'number') ? s.runningRow : null;
                    // if saved as running, reconstruct startTime and restart RAF
                    if(s.running){
                        t.running = true;
                        // saved.startTimestamp is a wall-clock ms timestamp representing when the run started
                        if(s.startTimestamp){
                            // compute performance.now()-based startTime so that (performance.now() - t.startTime) equals elapsed since saved.startTimestamp
                            t.startTime = performance.now() - (Date.now() - s.startTimestamp);
                        } else {
                            t.startTime = performance.now();
                        }
                        // mark button UI and start render loop
                        try{ t.holdBtn.classList.add('running'); }catch(e){}
                        if(typeof t.render === 'function') t.rafId = requestAnimationFrame(t.render);
                    } else {
                        t.running = false;
                    }
                    // update sheet cells for restored values
                    for(let r=0;r<ROWS;r++){
                        const cell = document.getElementById('sheet-r'+r+'-c'+i);
                        if(cell) cell.textContent = formatMs(t.elapsedPerRow[r] || 0);
                    }
                }
            }catch(err){
                console.error('Restore failed', err);
                const statusEl = document.getElementById('save-status');
                if(statusEl) statusEl.textContent = '(restore failed)';
            }
            // mark saved after restore
            const statusEl = document.getElementById('save-status');
            if(statusEl) statusEl.textContent = '(restored)';
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
    // persist selection
    try{ saveState(); }catch(e){}
    }

    // attach click/touch handlers to each row
    for(let r=0;r<ROWS;r++){
        const rowEl = document.getElementById('sheet-row-'+r);
        if(!rowEl) continue;
        rowEl.addEventListener('click', ()=> setActiveRow(r));
        rowEl.addEventListener('touchend', (e)=>{ e.preventDefault(); setActiveRow(r); }, {passive:false});
    }

    // set initial active row
    setActiveRow(activeRow);

    // Global Reset All button
    const resetAllBtn = document.getElementById('reset-all');
    if(resetAllBtn){
        const doResetAll = ()=>{
            timers.forEach(t=>{
                if(typeof t.reset === 'function') t.reset();
            });
        };
        resetAllBtn.addEventListener('click', doResetAll);
        resetAllBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); doResetAll(); }, {passive:false});
    }

    // Export / Import state handlers (JSON)
    const exportBtn = document.getElementById('export-state');
    const importBtn = document.getElementById('import-state');
    const importFile = document.getElementById('import-file');
    if(exportBtn){
        exportBtn.addEventListener('click', ()=>{
            try{
                const raw = localStorage.getItem(STORAGE_KEY) || JSON.stringify({ activeRow, timers: timers.map(t=>({ elapsedPerRow: t.elapsedPerRow, running: t.running, runningRow: t.runningRow, baseElapsed: t.baseElapsed })) });
                const blob = new Blob([raw], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'timestudy-state.json';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            }catch(err){ console.error('Export failed', err); }
        });
    }
    if(importBtn && importFile){
        importBtn.addEventListener('click', ()=> importFile.click());
        importFile.addEventListener('change', (ev)=>{
            const f = ev.target.files && ev.target.files[0];
            if(!f) return;
            const reader = new FileReader();
            reader.onload = function(e){
                try{
                    const parsed = JSON.parse(String(e.target.result));
                    // basic validation
                    if(parsed && Array.isArray(parsed.timers)){
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                        // reload page so restore logic runs
                        location.reload();
                    } else {
                        alert('Invalid timestudy JSON file');
                    }
                }catch(err){ alert('Failed to import: ' + err.message); }
            };
            reader.readAsText(f);
        });
    }

    // save state on unload as a final safeguard
    window.addEventListener('beforeunload', ()=>{ try{ saveState(); }catch(e){} });

})();
