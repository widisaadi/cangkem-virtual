// Windows input helper for Cawal. Terminal detection and focus restoration
// are adapted from OpenWhispr's MIT-licensed windows-fast-paste.c.
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

class Paste {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int left, top, right, bottom; }
    [StructLayout(LayoutKind.Sequential)] struct MONITORINFO { public int size; public RECT monitor, work; public uint flags; }
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint first, uint second, bool attach);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder value, int size);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION data; }
    [StructLayout(LayoutKind.Explicit)] struct UNION {
        [FieldOffset(0)] public KEYBOARD keyboard;
        [FieldOffset(0)] public MOUSE mouse;
    }
    [StructLayout(LayoutKind.Sequential)] struct KEYBOARD { public ushort key, scan; public uint flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSE { public int x, y; public uint data, flags, time; public UIntPtr extra; }
    static INPUT Key(ushort key, bool up) {
        var input = new INPUT(); input.type = 1;
        input.data.keyboard.key = key; input.data.keyboard.flags = up ? 2u : 0u; return input;
    }
    static string Name(IntPtr window) {
        uint pid; GetWindowThreadProcessId(window, out pid);
        try { return Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant(); }
        catch { return "unknown"; }
    }
    static bool Terminal(IntPtr window) {
        var cls = new StringBuilder(256); GetClassName(window, cls, 256);
        string[] classes = { "ConsoleWindowClass", "CASCADIA_HOSTING_WINDOW_CLASS", "mintty", "VirtualConsoleClass", "PuTTY", "Alacritty", "org.wezfurlong.wezterm", "Hyper", "TMobaXterm", "kitty" };
        foreach (var item in classes) if (String.Equals(item, cls.ToString(), StringComparison.OrdinalIgnoreCase)) return true;
        string name = Name(window);
        return name == "termius" || name == "tabby" || name == "wave" || name == "rio";
    }
    static bool Restore(IntPtr target) {
        if (GetForegroundWindow() == target) return true;
        if (IsIconic(target)) ShowWindow(target, 9);
        uint ignored; uint self = GetCurrentThreadId();
        uint dest = GetWindowThreadProcessId(target, out ignored);
        uint foreground = GetWindowThreadProcessId(GetForegroundWindow(), out ignored);
        bool a = dest != 0 && dest != self && AttachThreadInput(self, dest, true);
        bool b = foreground != 0 && foreground != self && foreground != dest && AttachThreadInput(self, foreground, true);
        try { BringWindowToTop(target); SetForegroundWindow(target); }
        finally {
            if (b) AttachThreadInput(self, foreground, false);
            if (a) AttachThreadInput(self, dest, false);
        }
        Thread.Sleep(100);
        return GetForegroundWindow() == target;
    }
    static int Main(string[] args) {
        try {
            if (args.Length == 1 && args[0] == "capture") {
                // Report physical monitor coordinates; Electron converts these to DIP.
                SetProcessDpiAwarenessContext(new IntPtr(-4));
                IntPtr window = GetForegroundWindow(); uint pid;
                if (window == IntPtr.Zero) return 1;
                GetWindowThreadProcessId(window, out pid);
                Console.WriteLine(window.ToInt64().ToString("X") + " " + pid + " " + Name(window));
                var info = new MONITORINFO(); info.size = Marshal.SizeOf(typeof(MONITORINFO));
                if (GetMonitorInfo(MonitorFromWindow(window, 2), ref info)) {
                    Console.WriteLine("DISPLAY " + (info.monitor.left + (info.monitor.right - info.monitor.left) / 2) + " " + (info.monitor.top + (info.monitor.bottom - info.monitor.top) / 2));
                }
                return 0;
            }
            if (args.Length == 1 && args[0] == "mask") {
                // A registered hotkey swallows its key, so releasing Alt or Win
                // afterwards looks like a lone tap and opens the browser menu or
                // Start. An unassigned key (VK 0xE8) in between cancels that,
                // the same "menu mask" AutoHotkey uses. Nothing else receives it.
                if ((GetAsyncKeyState(0x12) & 0x8000) == 0 && (GetAsyncKeyState(0x5B) & 0x8000) == 0 && (GetAsyncKeyState(0x5C) & 0x8000) == 0) return 0;
                var mask = new INPUT[] { Key(0xE8,false), Key(0xE8,true) };
                return SendInput(2, mask, Marshal.SizeOf(typeof(INPUT))) == 2 ? 0 : 5;
            }
            if (args.Length != 3 || args[0] != "paste") return 2;
            IntPtr target = new IntPtr(Convert.ToInt64(args[1], 16));
            uint expectedPid = UInt32.Parse(args[2]); uint actualPid;
            GetWindowThreadProcessId(target, out actualPid);
            // Never redirect dictation into whichever window happens to be focused.
            if (!IsWindow(target) || expectedPid != actualPid || !Restore(target)) return 3;
            int[] modifiers = { 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0x5B, 0x5C };
            // Wait for the user's shortcut to be released instead of changing
            // physical modifier state underneath another application.
            for (int attempt = 0; attempt < 100; attempt++) {
                bool held = false;
                foreach (int modifier in modifiers) if ((GetAsyncKeyState(modifier) & 0x8000) != 0) held = true;
                if (!held) break;
                if (attempt == 99) return 4;
                Thread.Sleep(20);
            }
            if (GetForegroundWindow() != target) return 3;
            INPUT[] keys = Terminal(target)
                ? new INPUT[] { Key(0x11,false), Key(0x10,false), Key(0x56,false), Key(0x56,true), Key(0x10,true), Key(0x11,true) }
                : new INPUT[] { Key(0x11,false), Key(0x56,false), Key(0x56,true), Key(0x11,true) };
            uint sent = SendInput((uint)keys.Length, keys, Marshal.SizeOf(typeof(INPUT)));
            if (sent != keys.Length) {
                var release = new INPUT[] { Key(0x56,true), Key(0x10,true), Key(0x11,true) };
                SendInput((uint)release.Length, release, Marshal.SizeOf(typeof(INPUT))); return 5;
            }
            Console.WriteLine("PASTE_OK"); return 0;
        } catch { return 1; }
    }
}
