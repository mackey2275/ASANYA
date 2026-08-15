async function installFsAccessMock(page) {
  await page.addInitScript(() => {
    const files = new Map(), directories = new Map(), openQueue = [], saveQueue = [], directoryQueue = [], calls = [];
    let clock = 1000;
    const error = (name, message) => Object.assign(new Error(message), { name });
    function record(op, id, extra = {}) { calls.push({ op, id, ...extra }); }
    function state(id) {
      const s = files.get(id);
      if (!s) throw new Error(`Unknown mock file: ${id}`);
      return s;
    }
    function handle(id) {
      return {
        kind: 'file',
        get name() { return state(id).name; },
        async getFile() {
          const s = state(id); s.getFileCount=(s.getFileCount||0)+1; record('getFile', id);
          if (s.failGetFile) throw error('NotReadableError', 'mock getFile failure');
          const text = s.text, modified = s.lastModified;
          if (s.mutateAfterGetFileCall===s.getFileCount) {
            s.text = s.mutateText; s.lastModified = ++clock; record('externalMutateAfterGetFile', id);
          }
          return { name:s.name, size:new Blob([text]).size, lastModified:modified, type:'application/json', async text(){ return text; } };
        },
        async createWritable() {
          const s = state(id); s.createCount=(s.createCount||0)+1; record('createWritable', id);
          if (s.failCreateWritable || s.failCreateOnCall===s.createCount) throw error('NotAllowedError', 'mock createWritable failure');
          let pending = s.text;
          return {
            async write(value) {
              s.writeCount=(s.writeCount||0)+1; record('write', id);
              if (s.failWrite || s.failWriteOnCall===s.writeCount) throw error('UnknownError', 'mock write failure');
              pending = typeof value === 'string' ? value : String(value);
            },
            async close() {
              s.closeCount=(s.closeCount||0)+1; record('close', id);
              if (s.failClose || s.failCloseOnCall===s.closeCount) throw error('UnknownError', 'mock close failure');
              s.text = pending; s.lastModified = ++clock;
            }
          };
        },
        async isSameEntry(other) { record('isSameEntry', id); return !!other && other.__mockId === id; },
        async queryPermission({ mode } = {}) {
          const s = state(id); record('queryPermission', id, { mode });
          return mode === 'read' ? s.readPermission : s.writePermission;
        },
        async requestPermission({ mode } = {}) {
          const s = state(id); record('requestPermission', id, { mode });
          const result = mode === 'read' ? s.requestReadResult : s.requestWriteResult;
          if (result === 'granted') mode === 'read' ? s.readPermission='granted' : s.writePermission='granted';
          return result;
        },
        __mockId: id
      };
    }
    function directoryHandle(id) {
      const dir = directories.get(id);
      if (!dir) throw new Error(`Unknown mock directory: ${id}`);
      return {
        kind:'directory', name:dir.name, __mockId:id,
        async getFileHandle(name,{create=false}={}) {
          record('getFileHandle',id,{name,create});
          if (dir.failGetFileHandle) throw error('NotAllowedError','mock getFileHandle failure');
          let fileId=dir.entries.get(name);
          if (!fileId && !create) throw error('NotFoundError','mock file not found');
          if (!fileId) {
            fileId=`${id}/${name}`; dir.entries.set(name,fileId);
            files.set(fileId,{name,text:'',lastModified:++clock,readPermission:'granted',writePermission:'granted',requestReadResult:'granted',requestWriteResult:'granted',failGetFile:false,failCreateWritable:false,failWrite:false,failClose:false,failCreateOnCall:0,failWriteOnCall:0,failCloseOnCall:0,createCount:0,writeCount:0,closeCount:0,getFileCount:0,mutateAfterGetFileCall:0,mutateText:''});
          }
          Object.assign(state(fileId),dir.newFileOptions||{});
          return handle(fileId);
        },
        async removeEntry(name) {
          record('removeEntry',id,{name});
          const fileId=dir.entries.get(name); if(fileId){dir.entries.delete(name);files.delete(fileId)}
        }
      };
    }
    window.__fsMock = {
      reset() { files.clear(); directories.clear(); openQueue.length=0; saveQueue.length=0; directoryQueue.length=0; calls.length=0; clock=1000; },
      create(id, options = {}) {
        files.set(id, { name:options.name||`${id}.json`, text:options.text||'', lastModified:options.lastModified||++clock,
          readPermission:options.readPermission||'granted', writePermission:options.writePermission||'granted',
          requestReadResult:options.requestReadResult||'granted', requestWriteResult:options.requestWriteResult||'granted',
          failGetFile:false, failCreateWritable:false, failWrite:false, failClose:false,
          failCreateOnCall:0, failWriteOnCall:0, failCloseOnCall:0, createCount:0, writeCount:0, closeCount:0,
          getFileCount:0, mutateAfterGetFileCall:0, mutateText:'', ...options });
        return handle(id);
      },
      queueOpen(id) { openQueue.push(id); }, queueSave(id) { saveQueue.push(id); },
      createDirectory(id,options={}) { directories.set(id,{name:options.name||id,entries:new Map(),failGetFileHandle:false,newFileOptions:{},...options}); return directoryHandle(id); },
      addDirectoryFile(directoryId,fileId,name,options={}) { this.create(fileId,{...options,name});directories.get(directoryId).entries.set(name,fileId);return handle(fileId); },
      queueDirectory(id) { directoryQueue.push(id); },
      directoryHandle(id) { return directoryHandle(id); },
      directoryEntries(id) { return [...directories.get(id).entries.entries()]; },
      mutate(id, text) { const s=state(id); s.text=text; s.lastModified=++clock; record('externalMutate', id); },
      configure(id, values) { Object.assign(state(id), values); },
      snapshot(id) { const s=state(id); return { ...s }; },
      calls() { return calls.map(x=>({ ...x })); },
      handle(id) { return handle(id); }
    };
    window.showOpenFilePicker = async options => {
      const id=openQueue.shift(); record('showOpenFilePicker', id||'', { pickerId:options?.id });
      if (!id) throw error('AbortError','mock picker cancelled');
      return [handle(id)];
    };
    window.showSaveFilePicker = async options => {
      const id=saveQueue.shift(); record('showSaveFilePicker', id||'', { suggestedName:options?.suggestedName });
      if (!id) throw error('AbortError','mock picker cancelled');
      return handle(id);
    };
    window.showDirectoryPicker = async options => {
      const id=directoryQueue.shift(); record('showDirectoryPicker',id||'',{pickerId:options?.id,startIn:options?.startIn?.__mockId||''});
      if (!id) throw error('AbortError','mock picker cancelled');
      return directoryHandle(id);
    };
  });
}

module.exports = { installFsAccessMock };
