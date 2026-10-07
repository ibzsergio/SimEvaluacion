/** Subconjunto educativo de tkinter que pinta widgets en el navegador (Pyodide). */
export const TKINTER_SHIM = String.raw`
import sys, types
from js import document, window
try:
    from pyodide.ffi import create_proxy
except Exception:
    def create_proxy(fn):
        return fn

_proxies = []

def _listen(el, event, fn):
    def wrapped(evt=None):
        try:
            try:
                fn(evt)
            except TypeError:
                fn()
        except Exception as err:
            print("Error en evento Tkinter:", err)
            try:
                import traceback
                traceback.print_exc()
            except Exception:
                pass
    proxy = create_proxy(wrapped)
    _proxies.append(proxy)
    el.addEventListener(event, proxy)
    try:
        setattr(el, "on" + event, proxy)
    except Exception:
        pass

N="n"; S="s"; W="w"; E="e"; NE="ne"; NW="nw"; SE="se"; SW="sw"
NS="ns"; EW="ew"; NSEW="nsew"; CENTER="center"
TOP="top"; BOTTOM="bottom"; LEFT="left"; RIGHT="right"
BOTH="both"; X="x"; Y="y"; END="end"; INSERT="insert"
CURRENT="current"; ALL="all"; ACTIVE="active"
NORMAL="normal"; DISABLED="disabled"; HIDDEN="hidden"
HORIZONTAL="horizontal"; VERTICAL="vertical"
SINGLE="single"; BROWSE="browse"; MULTIPLE="multiple"; EXTENDED="extended"
WORD="word"; CHAR="char"; NONE="none"
SUNKEN="sunken"; RAISED="raised"; GROOVE="groove"; RIDGE="ridge"; FLAT="flat"; SOLID="solid"
TRUE=True; FALSE=False; YES=True; NO=False
SEL="sel"; ANCHOR="anchor"

def _host():
    el = getattr(window, "__SIMEVAL_TK_HOST", None)
    if el is None:
        raise RuntimeError("No hay panel Tkinter en la página.")
    return el

def _font_css(font):
    if not font:
        return None
    if isinstance(font, str):
        return font
    try:
        family = font[0] if len(font) > 0 else "sans-serif"
        size = font[1] if len(font) > 1 else 12
        extra = str(font[2]).lower() if len(font) > 2 else ""
        weight = "bold" if "bold" in extra else "normal"
        style = "italic" if "italic" in extra else "normal"
        return f"{style} {weight} {int(size)}px {family}, sans-serif"
    except Exception:
        return None

def _apply_opts(el, kw):
    bg = kw.get("bg") or kw.get("background")
    fg = kw.get("fg") or kw.get("foreground")
    if bg: el.style.background = str(bg)
    if fg: el.style.color = str(fg)
    font = _font_css(kw.get("font"))
    if font: el.style.font = font
    if kw.get("width") is not None:
        try: el.style.minWidth = str(int(kw["width"]) * 0.65) + "em"
        except Exception: pass
    if kw.get("height") is not None:
        try: el.style.minHeight = str(int(kw["height"]) * 1.15) + "em"
        except Exception: pass
    if kw.get("relief") in ("solid","ridge","groove","sunken","raised"):
        el.style.border = "1px solid rgba(15,23,42,0.25)"
        el.style.borderRadius = "8px"
    padx, pady = kw.get("padx"), kw.get("pady")
    if padx is not None or pady is not None:
        el.style.padding = str(int(pady or 4)) + "px " + str(int(padx or 6)) + "px"
    if str(kw.get("state","")).lower() == "disabled":
        el.disabled = True
        el.style.opacity = "0.55"
        el.style.pointerEvents = "none"
    justify = str(kw.get("justify") or kw.get("anchor") or "").lower()
    if justify in ("center", "n", "s"):
        el.style.textAlign = "center"
    elif justify in ("right", "e"):
        el.style.textAlign = "right"
    elif justify in ("left", "w"):
        el.style.textAlign = "left"

class Variable:
    def __init__(self, value=""):
        self._value = value
        self._watchers = []
    def get(self):
        return self._value
    def set(self, value):
        self._value = value
        for fn in list(self._watchers):
            try: fn()
            except Exception: pass
    def trace_add(self, _mode, fn):
        self._watchers.append(lambda: fn())
        return "tr1"
    def trace(self, mode, fn):
        return self.trace_add(mode, fn)
    def _bind(self, fn):
        self._watchers.append(fn)

class StringVar(Variable):
    def __init__(self, master=None, value=""):
        super().__init__("" if value is None else str(value))
class IntVar(Variable):
    def __init__(self, master=None, value=0):
        super().__init__(int(value or 0))
    def get(self):
        try: return int(self._value)
        except Exception: return 0
class DoubleVar(Variable):
    def __init__(self, master=None, value=0.0):
        super().__init__(float(value or 0))
    def get(self):
        try: return float(self._value)
        except Exception: return 0.0
class BooleanVar(Variable):
    def __init__(self, master=None, value=False):
        super().__init__(bool(value))
    def get(self):
        return bool(self._value)

class PhotoImage:
    def __init__(self, name=None, file=None, data=None, **kw):
        self.file = file
        self.data = data
    def zoom(self, *a, **k): return self
    def subsample(self, *a, **k): return self
    def width(self): return 1
    def height(self): return 1
    def copy(self): return self

class BitmapImage(PhotoImage):
    pass

class _Widget:
    def __init__(self, master=None, **kw):
        self.master = master if master is not None else getattr(sys.modules["tkinter"], "_ROOT", None)
        self.kw = dict(kw)
        self.children = []
        self._el = document.createElement("div")
        self._el.className = "simeval-tk-widget"
        self.command = kw.get("command")
        _apply_opts(self._el, kw)
        parent = self.master._el if self.master is not None and hasattr(self.master, "_el") else _host()
        if self.master is not None and hasattr(self.master, "children"):
            self.master.children.append(self)
        parent.appendChild(self._el)
    def configure(self, cnf=None, **kw):
        if isinstance(cnf, str):
            return self.cget(cnf)
        if cnf: kw = {**cnf, **kw}
        self.kw.update(kw)
        if "command" in kw: self.command = kw["command"]
        if "text" in kw and hasattr(self, "_set_text"): self._set_text(kw["text"])
        if "textvariable" in kw: self._bind_var(kw["textvariable"])
        _apply_opts(self._el, kw)
        return self
    config = configure
    def cget(self, key):
        return self.kw.get(key)
    def __getitem__(self, key):
        return self.cget(key)
    def __setitem__(self, key, value):
        self.configure(**{key: value})
    def keys(self):
        return list(self.kw.keys())
    def _bind_var(self, var):
        if var is None: return
        def sync():
            if hasattr(self, "_set_text"):
                self._set_text(str(var.get()))
        var._bind(sync)
        sync()
    def pack(self, **opts):
        parent = self._el.parentElement
        if parent:
            parent.style.display = "flex"
            if not parent.getAttribute("data-tk-flex"):
                parent.setAttribute("data-tk-flex", "1")
                parent.style.flexDirection = "column"
                parent.style.flexWrap = "nowrap"
                parent.style.alignItems = "stretch"
        fill = str(opts.get("fill", "")).lower()
        if fill in ("x", "both"): self._el.style.width = "100%"
        if fill in ("y", "both"): self._el.style.flex = "1"
        if opts.get("expand"): self._el.style.flex = "1"
        side = str(opts.get("side", "top")).lower()
        if side in ("left", "right") and parent and parent.getAttribute("data-tk-flex") == "1":
            parent.style.flexDirection = "row"
            parent.setAttribute("data-tk-flex", "row")
        self._el.style.margin = str(int(opts.get("pady") or 0)) + "px " + str(int(opts.get("padx") or 0)) + "px"
        if str(opts.get("anchor", "")).lower() in ("center", "n"):
            self._el.style.alignSelf = "center"
        return self
    def pack_forget(self):
        self._el.style.display = "none"
        return self
    def pack_info(self):
        return {}
    def grid(self, **opts):
        parent = self._el.parentElement
        if parent:
            parent.style.display = "grid"
            parent.style.gap = "6px"
            parent.style.alignItems = "center"
        r = int(opts.get("row") or 0) + 1
        c = int(opts.get("column") or 0) + 1
        self._el.style.gridRow = str(r) + " / span " + str(int(opts.get("rowspan") or 1))
        self._el.style.gridColumn = str(c) + " / span " + str(int(opts.get("columnspan") or 1))
        self._el.style.margin = str(int(opts.get("pady") or 0)) + "px " + str(int(opts.get("padx") or 0)) + "px"
        sticky = str(opts.get("sticky", "")).lower()
        if "ew" in sticky or sticky in ("ew", "nsew"): self._el.style.width = "100%"
        if "ns" in sticky or sticky == "nsew": self._el.style.height = "100%"
        return self
    def grid_forget(self):
        self._el.style.display = "none"
        return self
    def grid_columnconfigure(self, *a, **k): return self
    def grid_rowconfigure(self, *a, **k): return self
    def columnconfigure(self, *a, **k): return self
    def rowconfigure(self, *a, **k): return self
    def place(self, **opts):
        parent = self._el.parentElement
        if parent: parent.style.position = "relative"
        self._el.style.position = "absolute"
        if "x" in opts: self._el.style.left = str(int(opts["x"])) + "px"
        if "y" in opts: self._el.style.top = str(int(opts["y"])) + "px"
        if "relx" in opts: self._el.style.left = str(float(opts["relx"]) * 100) + "%"
        if "rely" in opts: self._el.style.top = str(float(opts["rely"]) * 100) + "%"
        return self
    def place_forget(self):
        self._el.style.display = "none"
        return self
    def bind(self, sequence, func, add=None):
        seq = str(sequence).lower().replace("<", "").replace(">", "")
        ev = "click"
        if "key" in seq or seq in ("return", "enter"): ev = "keydown"
        elif "motion" in seq: ev = "mousemove"
        elif "release" in seq: ev = "mouseup"
        elif "press" in seq or "button" in seq: ev = "mousedown"
        def handler(js_ev):
            if ev == "keydown" and seq in ("return", "enter"):
                key = str(getattr(js_ev, "key", "") or "")
                if key not in ("Enter", "Return"):
                    return
            try: func(js_ev)
            except TypeError: func()
        _listen(self._el, ev, handler)
        if hasattr(self, "_inp"):
            _listen(self._inp, ev, handler)
        return self
    def unbind(self, sequence):
        return self
    def event_generate(self, *a, **k):
        return self
    def destroy(self):
        try: self._el.remove()
        except Exception: pass
    def winfo_width(self): return int(self._el.clientWidth or 0)
    def winfo_height(self): return int(self._el.clientHeight or 0)
    def winfo_reqwidth(self): return self.winfo_width()
    def winfo_reqheight(self): return self.winfo_height()
    def winfo_x(self): return 0
    def winfo_y(self): return 0
    def winfo_rootx(self): return 0
    def winfo_rooty(self): return 0
    def winfo_id(self): return id(self)
    def winfo_exists(self): return 1
    def winfo_ismapped(self): return 1
    def winfo_viewable(self): return 1
    def winfo_children(self): return list(self.children)
    def winfo_screenwidth(self): return int(window.innerWidth or 360)
    def winfo_screenheight(self): return int(window.innerHeight or 640)
    def update(self): pass
    def update_idletasks(self): pass
    def after(self, ms, fn=None):
        if fn is None: return
        proxy = create_proxy(lambda: fn())
        _proxies.append(proxy)
        window.setTimeout(proxy, int(ms or 0))
        return "after1"
    def after_cancel(self, ident): pass
    def focus_set(self):
        try:
            target = getattr(self, "_inp", None) or getattr(self, "_btn", None) or self._el
            target.focus()
        except Exception: pass
    def focus(self):
        self.focus_set()
    def lift(self): pass
    def lower(self): pass
    def tkraise(self): pass
    def grab_set(self): pass
    def grab_release(self): pass
    def wait_window(self): pass
    def wait_visibility(self): pass
    def option_add(self, *a, **k): pass
    def clipboard_clear(self): pass
    def clipboard_append(self, text):
        try: window.navigator.clipboard.writeText(str(text))
        except Exception: pass
    def bell(self): pass
    def yview(self, *a, **k): pass
    def xview(self, *a, **k): pass
    def yview_moveto(self, *a): pass
    def xview_moveto(self, *a): pass
    def see(self, *a): pass
    def size(self): return 0
    def state(self): return "normal"
    def invoke(self):
        if self.command:
            self.command()

class Tk(_Widget):
    def __init__(self, *args, **kw):
        self.master = None
        self.children = []
        self.kw = dict(kw)
        host = _host()
        host.innerHTML = ""
        host.style.position = "relative"
        self._el = document.createElement("div")
        self._el.className = "simeval-tk-root"
        self._el.style.cssText = "box-sizing:border-box;width:100%;max-width:100%;min-height:16rem;background:#e5e7eb;color:#0f172a;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;overflow:auto;"
        _apply_opts(self._el, kw)
        host.appendChild(self._el)
        sys.modules["tkinter"]._ROOT = self
        title = document.createElement("div")
        title.textContent = "Tk"
        title.style.cssText = "font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#334155;margin-bottom:4px;flex-shrink:0;"
        self._title_el = title
        self._el.appendChild(title)
    def title(self, text=None):
        if text is None: return self._title_el.textContent
        self._title_el.textContent = str(text)
        return self
    wm_title = title
    def geometry(self, value=None):
        if not value: return
        try:
            w, h = str(value).lower().split("x")
            w = "".join(ch for ch in w if ch.isdigit())
            h = "".join(ch for ch in h.split("+")[0] if ch.isdigit())
            if w:
                self._el.style.width = "min(" + str(int(w)) + "px, 100%)"
            if h:
                self._el.style.minHeight = str(int(h)) + "px"
        except Exception:
            pass
        return self
    def configure(self, cnf=None, **kw):
        if isinstance(cnf, str): return self.cget(cnf)
        if cnf: kw = {**cnf, **kw}
        self.kw.update(kw)
        _apply_opts(self._el, kw)
        return self
    config = configure
    def resizable(self, *a, **k): return self
    def minsize(self, *a, **k): return self
    def maxsize(self, *a, **k): return self
    def protocol(self, *a, **k): return self
    def attributes(self, *a, **k): return self
    def wm_attributes(self, *a, **k): return self
    def iconbitmap(self, *a, **k): return self
    def iconphoto(self, *a, **k): return self
    def overrideredirect(self, *a, **k): return self
    def transient(self, *a, **k): return self
    def option_add(self, *a, **k): pass
    def iconify(self): pass
    def deiconify(self): pass
    def withdraw(self): pass
    def state(self, *a): return "normal"
    def quit(self): pass
    def mainloop(self, n=0): return None
    def destroy(self):
        _host().innerHTML = ""
    def report_callback_exception(self, *a):
        print(a)

class Toplevel(Tk):
    def __init__(self, master=None, **kw):
        super().__init__()
        if kw.get("title"): self.title(kw.get("title"))

class Frame(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        self._el.style.display = "flex"
        self._el.style.flexDirection = "column"
        self._el.style.gap = "4px"
        self._el.style.boxSizing = "border-box"
        if kw.get("bd") or kw.get("borderwidth") or kw.get("relief"):
            self._el.style.border = "1px solid rgba(15,23,42,0.18)"
            self._el.style.padding = "8px"
            self._el.style.borderRadius = "8px"

class LabelFrame(Frame):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        text = kw.get("text", "")
        if text:
            lab = document.createElement("div")
            lab.textContent = str(text)
            lab.style.cssText = "font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;"
            self._el.insertBefore(lab, self._el.firstChild)

class PanedWindow(Frame):
    def add(self, child, **kw):
        return child

class Label(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        self._el.style.padding = "4px 2px"
        self._set_text(kw.get("text", ""))
        if kw.get("textvariable"): self._bind_var(kw["textvariable"])
        if kw.get("wraplength"):
            try:
                self._el.style.maxWidth = str(int(kw["wraplength"])) + "px"
                self._el.style.whiteSpace = "normal"
            except Exception:
                pass
        if kw.get("image") and not kw.get("text"):
            self._el.textContent = "[imagen]"
    def _set_text(self, text):
        self._el.textContent = "" if text is None else str(text)

class Message(Label):
    pass

class Button(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        btn = document.createElement("button")
        btn.type = "button"
        btn.textContent = str(kw.get("text", "Botón"))
        btn.style.cssText = "cursor:pointer;border-radius:8px;border:1px solid rgba(15,23,42,0.2);padding:8px 12px;background:#f8fafc;color:#0f172a;font:inherit;min-height:40px;width:100%;box-sizing:border-box;"
        _apply_opts(btn, kw)
        def on_click(_ev=None):
            cmd = self.command
            if cmd: cmd()
        _listen(btn, "click", on_click)
        self._el.appendChild(btn)
        self._btn = btn
    def _set_text(self, text):
        self._btn.textContent = str(text)
    def invoke(self):
        if self.command: self.command()

class Entry(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        inp = document.createElement("input")
        show = str(kw.get("show", ""))
        inp.type = "password" if show in ("*", "•") else "text"
        inp.value = str(kw.get("text", ""))
        inp.style.cssText = "width:100%;max-width:100%;min-height:40px;border-radius:8px;border:1px solid #94a3b8;padding:8px 10px;font-size:16px;background:#fff;color:#0f172a;box-sizing:border-box;"
        _apply_opts(inp, kw)
        self._var = kw.get("textvariable")
        if self._var is not None:
            inp.value = str(self._var.get())
            def on_input(_ev=None):
                self._var.set(inp.value)
            _listen(inp, "input", on_input)
            def sync():
                if inp.value != str(self._var.get()):
                    inp.value = str(self._var.get())
            self._var._bind(sync)
        self._el.appendChild(inp)
        self._inp = inp
    def get(self):
        return self._inp.value
    def insert(self, index, text):
        v = self._inp.value
        self._inp.value = v + str(text) if index == END or str(index).lower() == "end" else str(text) + v
        if self._var is not None: self._var.set(self._inp.value)
    def delete(self, first, last=None):
        self._inp.value = ""
        if self._var is not None: self._var.set("")
    def icursor(self, index): pass
    def selection_range(self, *a): pass

class Text(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        ta = document.createElement("textarea")
        ta.style.cssText = "width:100%;min-height:8rem;border-radius:8px;border:1px solid #94a3b8;padding:8px;font-size:16px;font-family:ui-monospace,monospace;background:#fff;color:#0f172a;box-sizing:border-box;"
        if kw.get("width"): ta.cols = int(kw["width"])
        if kw.get("height"): ta.rows = int(kw["height"])
        self._el.appendChild(ta)
        self._ta = ta
        self._inp = ta
    def get(self, start="1.0", end="end"):
        return self._ta.value
    def insert(self, index, text):
        self._ta.value += str(text)
    def delete(self, start="1.0", end="end"):
        self._ta.value = ""
    def see(self, index): pass

class Checkbutton(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        wrap = document.createElement("label")
        wrap.style.cssText = "display:flex;align-items:center;gap:8px;min-height:40px;cursor:pointer;"
        inp = document.createElement("input")
        inp.type = "checkbox"
        lab = document.createElement("span")
        lab.textContent = str(kw.get("text",""))
        self._var = kw.get("variable")
        self._on = kw.get("onvalue", True)
        self._off = kw.get("offvalue", False)
        if self._var is not None: inp.checked = bool(self._var.get())
        def on_change(_ev=None):
            if self._var is not None: self._var.set(self._on if inp.checked else self._off)
            if self.command: self.command()
        _listen(inp, "change", on_change)
        wrap.appendChild(inp)
        wrap.appendChild(lab)
        self._el.appendChild(wrap)
        self._inp = inp
    def select(self):
        self._inp.checked = True
        if self._var is not None: self._var.set(self._on)
    def deselect(self):
        self._inp.checked = False
        if self._var is not None: self._var.set(self._off)
    def toggle(self):
        if self._inp.checked: self.deselect()
        else: self.select()

class Radiobutton(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        wrap = document.createElement("label")
        wrap.style.cssText = "display:flex;align-items:center;gap:8px;min-height:40px;cursor:pointer;"
        inp = document.createElement("input")
        inp.type = "radio"
        self._var = kw.get("variable")
        inp.name = "simeval-radio-" + str(id(self._var) if self._var is not None else 0)
        lab = document.createElement("span")
        lab.textContent = str(kw.get("text",""))
        self._value = kw.get("value")
        if self._var is not None and self._var.get() == self._value: inp.checked = True
        def on_change(_ev=None):
            if self._var is not None: self._var.set(self._value)
            if self.command: self.command()
        _listen(inp, "change", on_change)
        wrap.appendChild(inp)
        wrap.appendChild(lab)
        self._el.appendChild(wrap)
        self._inp = inp
    def select(self):
        self._inp.checked = True
        if self._var is not None: self._var.set(self._value)

class Listbox(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        sel = document.createElement("select")
        sel.multiple = str(kw.get("selectmode", "browse")).lower() in ("multiple", "extended")
        sel.size = int(kw.get("height") or 6)
        sel.style.cssText = "width:100%;min-height:6rem;font-size:16px;background:#fff;color:#0f172a;"
        self._el.appendChild(sel)
        self._sel = sel
        self._items = []
    def insert(self, index, *items):
        for item in items:
            opt = document.createElement("option")
            opt.textContent = str(item)
            if index == END or str(index).lower() == "end":
                self._sel.appendChild(opt)
            else:
                self._sel.appendChild(opt)
            self._items.append(str(item))
    def delete(self, first, last=None):
        self._sel.innerHTML = ""
        self._items = []
    def curselection(self):
        out = []
        opts = self._sel.options
        for i in range(opts.length):
            if opts.item(i).selected: out.append(i)
        return tuple(out)
    def get(self, first, last=None):
        if first == ACTIVE or str(first) == "active":
            i = self._sel.selectedIndex
            return self._items[i] if 0 <= i < len(self._items) else ""
        try: return self._items[int(first)]
        except Exception: return ""
    def selection_set(self, first, last=None):
        try: self._sel.selectedIndex = int(first)
        except Exception: pass
    def selection_clear(self, first, last=None):
        self._sel.selectedIndex = -1
    def size(self):
        return len(self._items)

class Scale(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        inp = document.createElement("input")
        inp.type = "range"
        inp.min = str(kw.get("from_") if "from_" in kw else kw.get("from", 0))
        inp.max = str(kw.get("to", 100))
        inp.step = str(kw.get("resolution") or 1)
        self._var = kw.get("variable")
        if self._var is not None: inp.value = str(self._var.get())
        def on_input(_ev=None):
            if self._var is not None:
                try: self._var.set(int(float(inp.value)))
                except Exception: self._var.set(inp.value)
            if self.command:
                try: self.command(inp.value)
                except TypeError: self.command()
        _listen(inp, "input", on_input)
        inp.style.width = "100%"
        self._el.appendChild(inp)
        self._inp = inp
    def get(self):
        try: return int(float(self._inp.value))
        except Exception: return 0
    def set(self, value):
        self._inp.value = str(value)
        if self._var is not None: self._var.set(value)

class Spinbox(Entry):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        self._inp.type = "number"
        if "from_" in kw: self._inp.min = str(kw["from_"])
        elif "from" in kw: self._inp.min = str(kw["from"])
        if "to" in kw: self._inp.max = str(kw["to"])
        if "increment" in kw: self._inp.step = str(kw["increment"])

class Combobox(Entry):
    def __init__(self, master=None, **kw):
        values = list(kw.pop("values", ()) or ())
        super().__init__(master, **kw)
        if values:
            sel = document.createElement("select")
            sel.style.cssText = "width:100%;min-height:40px;font-size:16px;border-radius:8px;border:1px solid #94a3b8;background:#fff;color:#0f172a;"
            for v in values:
                o = document.createElement("option")
                o.textContent = str(v)
                o.value = str(v)
                sel.appendChild(o)
            if self._var is not None:
                sel.value = str(self._var.get())
                def on_change(_=None):
                    self._var.set(sel.value)
                    if self.command: self.command()
                _listen(sel, "change", on_change)
            try: self._inp.remove()
            except Exception: pass
            self._el.appendChild(sel)
            self._inp = sel
            self._sel = sel
    def current(self, index=None):
        if index is None:
            return getattr(self._inp, "selectedIndex", 0)
        try: self._inp.selectedIndex = int(index)
        except Exception: pass
        return index
    def set(self, value):
        self._inp.value = str(value)
        if self._var is not None: self._var.set(value)

class OptionMenu(_Widget):
    def __init__(self, master, variable, value, *values, **kw):
        command = kw.pop("command", None)
        super().__init__(master, **kw)
        self.command = command
        self._var = variable
        sel = document.createElement("select")
        sel.style.cssText = "width:100%;min-height:40px;font-size:16px;border-radius:8px;border:1px solid #94a3b8;background:#fff;color:#0f172a;"
        opts = (value,) + tuple(values)
        for v in opts:
            o = document.createElement("option")
            o.textContent = str(v)
            o.value = str(v)
            sel.appendChild(o)
        if variable is not None:
            sel.value = str(variable.get() or value)
        def on_change(_=None):
            if variable is not None: variable.set(sel.value)
            if self.command:
                try: self.command(sel.value)
                except TypeError: self.command()
        _listen(sel, "change", on_change)
        self._el.appendChild(sel)
        self._inp = sel

class Scrollbar(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        orient = str(kw.get("orient", VERTICAL)).lower()
        self._el.style.background = "#cbd5e1"
        self._el.style.borderRadius = "99px"
        if orient == "horizontal":
            self._el.style.height = "8px"
            self._el.style.width = "100%"
        else:
            self._el.style.width = "8px"
            self._el.style.minHeight = "4rem"
    def set(self, *a): pass
    def get(self): return (0.0, 1.0)

class Canvas(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        cv = document.createElement("canvas")
        cv.width = int(kw.get("width") or 320)
        cv.height = int(kw.get("height") or 200)
        bg = str(kw.get("bg") or kw.get("background") or "#fff")
        cv.style.cssText = "max-width:100%;background:" + bg + ";border:1px solid #cbd5e1;border-radius:8px;display:block;"
        self._el.appendChild(cv)
        self._cv = cv
        self._ctx = cv.getContext("2d")
        self._id = 0
        self._items = {}
    def _next(self):
        self._id += 1
        return self._id
    def create_line(self, *coords, **kw):
        ctx = self._ctx
        ctx.beginPath()
        pts = list(coords)
        if len(pts) == 1 and hasattr(pts[0], "__iter__"):
            pts = list(pts[0])
        if pts:
            ctx.moveTo(float(pts[0]), float(pts[1]))
            i = 2
            while i + 1 < len(pts):
                ctx.lineTo(float(pts[i]), float(pts[i+1]))
                i += 2
        ctx.strokeStyle = str(kw.get("fill") or kw.get("outline") or "#0f172a")
        ctx.lineWidth = float(kw.get("width") or 1)
        ctx.stroke()
        return self._next()
    def create_rectangle(self, x1, y1, x2, y2, **kw):
        ctx = self._ctx
        if kw.get("fill"):
            ctx.fillStyle = str(kw["fill"])
            ctx.fillRect(float(x1), float(y1), float(x2)-float(x1), float(y2)-float(y1))
        ctx.strokeStyle = str(kw.get("outline") or "#0f172a")
        ctx.strokeRect(float(x1), float(y1), float(x2)-float(x1), float(y2)-float(y1))
        return self._next()
    def create_oval(self, x1, y1, x2, y2, **kw):
        ctx = self._ctx
        ctx.beginPath()
        cx = (float(x1)+float(x2))/2
        cy = (float(y1)+float(y2))/2
        rx = abs(float(x2)-float(x1))/2
        ry = abs(float(y2)-float(y1))/2
        ctx.ellipse(cx, cy, max(rx,0.5), max(ry,0.5), 0, 0, 6.283)
        if kw.get("fill"):
            ctx.fillStyle = str(kw["fill"])
            ctx.fill()
        ctx.strokeStyle = str(kw.get("outline") or "#0f172a")
        ctx.stroke()
        return self._next()
    def create_polygon(self, *coords, **kw):
        pts = list(coords)
        if pts and hasattr(pts[0], "__iter__") and not isinstance(pts[0], (str, bytes)):
            pts = list(pts[0])
        ctx = self._ctx
        ctx.beginPath()
        if pts:
            ctx.moveTo(float(pts[0]), float(pts[1]))
            i = 2
            while i + 1 < len(pts):
                ctx.lineTo(float(pts[i]), float(pts[i+1]))
                i += 2
            ctx.closePath()
        if kw.get("fill"):
            ctx.fillStyle = str(kw["fill"])
            ctx.fill()
        ctx.strokeStyle = str(kw.get("outline") or "#0f172a")
        ctx.stroke()
        return self._next()
    def create_text(self, x, y, **kw):
        ctx = self._ctx
        ctx.fillStyle = str(kw.get("fill") or "#0f172a")
        ctx.font = "14px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(str(kw.get("text","")), float(x), float(y))
        return self._next()
    def create_image(self, x, y, **kw):
        return self.create_text(x, y, text="[img]", fill="#64748b")
    def create_arc(self, x1, y1, x2, y2, **kw):
        return self.create_oval(x1, y1, x2, y2, **kw)
    def delete(self, *args):
        self._ctx.clearRect(0, 0, self._cv.width, self._cv.height)
    def itemconfig(self, *a, **k): pass
    def itemconfigure(self, *a, **k): pass
    def coords(self, *a): return [0, 0]
    def move(self, *a): pass
    def tag_bind(self, *a, **k): pass
    def find_overlapping(self, *a): return ()
    def bbox(self, *a): return (0, 0, 0, 0)

class Menu(_Widget):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        self._el.style.display = "flex"
        self._el.style.flexWrap = "wrap"
        self._el.style.gap = "4px"
        self._el.style.background = "#f1f5f9"
        self._el.style.padding = "4px"
        self._el.style.borderRadius = "8px"
    def add_command(self, **kw):
        b = document.createElement("button")
        b.type = "button"
        b.textContent = str(kw.get("label", "menú"))
        b.style.cssText = "border:0;background:transparent;color:#0f172a;padding:6px 8px;font:inherit;cursor:pointer;min-height:36px;"
        cmd = kw.get("command")
        if cmd: _listen(b, "click", lambda _e=None: cmd())
        self._el.appendChild(b)
    def add_separator(self):
        span = document.createElement("span")
        span.textContent = "|"
        span.style.opacity = "0.4"
        self._el.appendChild(span)
    def add_cascade(self, **kw):
        self.add_command(**kw)
    def add_checkbutton(self, **kw):
        self.add_command(**kw)
    def add_radiobutton(self, **kw):
        self.add_command(**kw)
    def delete(self, *a):
        self._el.innerHTML = ""
    def entryconfig(self, *a, **k): pass

class Menubutton(Button):
    pass

class Notebook(Frame):
    def __init__(self, master=None, **kw):
        super().__init__(master, **kw)
        self._tabs = []
        bar = document.createElement("div")
        bar.style.cssText = "display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;"
        self._bar = bar
        self._el.insertBefore(bar, self._el.firstChild)
        self._pages = document.createElement("div")
        self._el.appendChild(self._pages)
    def add(self, child, **kw):
        text = str(kw.get("text", "Pestaña"))
        btn = document.createElement("button")
        btn.type = "button"
        btn.textContent = text
        btn.style.cssText = "min-height:36px;padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;"
        page = getattr(child, "_el", None)
        if page is not None and page.parentElement:
            self._pages.appendChild(page)
        self._tabs.append((btn, page))
        def show(_=None):
            for b, p in self._tabs:
                if p is not None: p.style.display = "none"
                b.style.background = "#fff"
            if page is not None: page.style.display = "block"
            btn.style.background = "#e0e7ff"
        _listen(btn, "click", show)
        self._bar.appendChild(btn)
        if len(self._tabs) == 1:
            show()
        else:
            if page is not None: page.style.display = "none"
    def select(self, index=0):
        if 0 <= index < len(self._tabs):
            self._tabs[index][0].click()

class Progressbar(Scale):
    pass

class Treeview(Listbox):
    def heading(self, *a, **k): pass
    def column(self, *a, **k): pass
    def insert(self, parent, index, **kw):
        iid = kw.get("iid") or ("i" + str(len(self._items)+1))
        vals = kw.get("values") or kw.get("text") or iid
        super().insert(END, vals)
        return iid
    def item(self, iid, **kw): return {}
    def get_children(self, item=""): return ()
    def selection(self): return self.curselection()

def mainloop(n=0):
    root = getattr(sys.modules["tkinter"], "_ROOT", None)
    if root is not None:
        root.mainloop()

def _popup(title, message, cancel=False):
    host = _host()
    host.style.position = "relative"
    overlay = document.createElement("div")
    overlay.style.cssText = "position:absolute;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:80;padding:12px;"
    box = document.createElement("div")
    box.style.cssText = "background:#fff;color:#0f172a;border-radius:12px;padding:16px 18px;width:min(22rem,100%);box-shadow:0 16px 40px rgba(0,0,0,.28);"
    h = document.createElement("p")
    h.textContent = str(title)
    h.style.cssText = "font-weight:800;font-size:15px;margin:0 0 8px;"
    p = document.createElement("p")
    p.textContent = str(message)
    p.style.cssText = "margin:0 0 14px;font-size:14px;line-height:1.45;white-space:pre-wrap;"
    row = document.createElement("div")
    row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;"
    ok = document.createElement("button")
    ok.type = "button"
    ok.textContent = "Aceptar"
    ok.style.cssText = "min-height:40px;padding:8px 14px;border-radius:8px;border:0;background:#4f46e5;color:#fff;font-weight:700;cursor:pointer;"
    def close(_e=None):
        overlay.remove()
    _listen(ok, "click", close)
    if cancel:
        no = document.createElement("button")
        no.type = "button"
        no.textContent = "Cancelar"
        no.style.cssText = "min-height:40px;padding:8px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;cursor:pointer;"
        _listen(no, "click", close)
        row.appendChild(no)
    row.appendChild(ok)
    box.appendChild(h)
    box.appendChild(p)
    box.appendChild(row)
    overlay.appendChild(box)
    host.appendChild(overlay)

class _Msg:
    @staticmethod
    def showinfo(title, message, **kw):
        _popup(title, message); return "ok"
    @staticmethod
    def showwarning(title, message, **kw):
        _popup(title, message); return "ok"
    @staticmethod
    def showerror(title, message, **kw):
        _popup(title, message); return "ok"
    @staticmethod
    def askyesno(title, message, **kw):
        try: return bool(window.confirm(str(title) + "\n\n" + str(message)))
        except Exception:
            _popup(title, message, True); return True
    @staticmethod
    def askokcancel(title, message, **kw):
        try: return bool(window.confirm(str(title) + "\n\n" + str(message)))
        except Exception:
            _popup(title, message, True); return True
    @staticmethod
    def askretrycancel(title, message, **kw):
        return _Msg.askokcancel(title, message)
    @staticmethod
    def askyesnocancel(title, message, **kw):
        ok = _Msg.askyesno(title, message)
        return ok if ok else False
    @staticmethod
    def askquestion(title, message, **kw):
        return "yes" if _Msg.askyesno(title, message) else "no"

messagebox = _Msg()

class _Simple:
    @staticmethod
    def askstring(title, prompt, **kw):
        return window.prompt(str(title) + " — " + str(prompt), str(kw.get("initialvalue") or ""))
    @staticmethod
    def askinteger(title, prompt, **kw):
        raw = window.prompt(str(title) + " — " + str(prompt), str(kw.get("initialvalue") or ""))
        try: return int(raw)
        except Exception: return None
    @staticmethod
    def askfloat(title, prompt, **kw):
        raw = window.prompt(str(title) + " — " + str(prompt), str(kw.get("initialvalue") or ""))
        try: return float(raw)
        except Exception: return None

simpledialog = _Simple()
filedialog = types.SimpleNamespace(
    askopenfilename=lambda **k: "",
    asksaveasfilename=lambda **k: "",
    askdirectory=lambda **k: "",
    askopenfilenames=lambda **k: (),
)
colorchooser = types.SimpleNamespace(askcolor=lambda **k: ((255,255,255),"#ffffff"))

class _Font:
    def __init__(self, root=None, **kw):
        self.kw = kw
    def configure(self, **kw):
        self.kw.update(kw)
    config = configure
    def actual(self, *a): return self.kw
    def measure(self, text): return len(str(text)) * 8
    def metrics(self, *a): return {"ascent": 12, "descent": 4, "linespace": 16}
font = types.SimpleNamespace(Font=_Font, nametofont=lambda n: _Font())

ttk = types.ModuleType("tkinter.ttk")
for _n, _v in [
    ("Button", Button), ("Label", Label), ("Entry", Entry), ("Frame", Frame),
    ("LabelFrame", LabelFrame), ("Checkbutton", Checkbutton), ("Radiobutton", Radiobutton),
    ("Scale", Scale), ("Spinbox", Spinbox), ("Combobox", Combobox), ("Notebook", Notebook),
    ("Separator", Frame), ("Progressbar", Progressbar), ("Treeview", Treeview),
    ("Scrollbar", Scrollbar), ("Menubutton", Menubutton), ("OptionMenu", OptionMenu),
    ("Panedwindow", PanedWindow), ("Sizegrip", Frame),
]:
    setattr(ttk, _n, _v)
class _Style:
    def theme_use(self, *a, **k): pass
    def theme_names(self): return ("default",)
    def configure(self, *a, **k): pass
    def map(self, *a, **k): pass
    def lookup(self, *a, **k): return ""
ttk.Style = _Style

constants = types.ModuleType("tkinter.constants")

tk_mod = types.ModuleType("tkinter")
g = globals()
for name in list(g):
    setattr(tk_mod, name, g[name])
tk_mod.Tk = Tk
tk_mod.Toplevel = Toplevel
tk_mod._ROOT = None
tk_mod.messagebox = messagebox
tk_mod.ttk = ttk
tk_mod.font = font
tk_mod.simpledialog = simpledialog
tk_mod.filedialog = filedialog
tk_mod.colorchooser = colorchooser
tk_mod.constants = constants
tk_mod.PhotoImage = PhotoImage
tk_mod.BitmapImage = BitmapImage
tk_mod.OptionMenu = OptionMenu
tk_mod.Scrollbar = Scrollbar
tk_mod.Canvas = Canvas
tk_mod.Menu = Menu
tk_mod.Menubutton = Menubutton
tk_mod.PanedWindow = PanedWindow
tk_mod.Text = Text
tk_mod.Listbox = Listbox
tk_mod.Scale = Scale
tk_mod.Spinbox = Spinbox
tk_mod.Checkbutton = Checkbutton
tk_mod.Radiobutton = Radiobutton
tk_mod.Frame = Frame
tk_mod.LabelFrame = LabelFrame
tk_mod.Label = Label
tk_mod.Button = Button
tk_mod.Entry = Entry
tk_mod.Message = Message
tk_mod.StringVar = StringVar
tk_mod.IntVar = IntVar
tk_mod.DoubleVar = DoubleVar
tk_mod.BooleanVar = BooleanVar
sys.modules["tkinter"] = tk_mod
msg = types.ModuleType("tkinter.messagebox")
for n in ("showinfo","showwarning","showerror","askyesno","askokcancel","askquestion","askretrycancel","askyesnocancel"):
    setattr(msg, n, getattr(messagebox, n))
sys.modules["tkinter.messagebox"] = msg
tk_mod.messagebox = messagebox
sys.modules["tkinter.ttk"] = ttk
sys.modules["tkinter.font"] = font
sys.modules["tkinter.simpledialog"] = simpledialog
sys.modules["tkinter.filedialog"] = filedialog
sys.modules["tkinter.colorchooser"] = colorchooser
sys.modules["tkinter.constants"] = constants
`;
