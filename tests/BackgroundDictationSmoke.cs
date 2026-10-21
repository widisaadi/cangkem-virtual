using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

class BackgroundDictationSmoke {
    [DllImport("user32.dll")] static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint first, uint second, bool attach);
    static void Shortcut() {
        keybd_event(0x11, 0, 0, UIntPtr.Zero);
        keybd_event(0x10, 0, 0, UIntPtr.Zero);
        keybd_event(0x4B, 0, 0, UIntPtr.Zero);
        keybd_event(0x4B, 0, 2, UIntPtr.Zero);
        keybd_event(0x10, 0, 2, UIntPtr.Zero);
        keybd_event(0x11, 0, 2, UIntPtr.Zero);
    }
    [STAThread] static int Main(string[] args) {
        int result = 1, ticks = 0;
        var form = new Form { Text = "Cawal background dictation verification", StartPosition = FormStartPosition.Manual, Location = new Point(-12000, -12000), Size = new Size(300, 150), ShowInTaskbar = false };
        if (args.Length == 2) { form.Location = new Point(Int32.Parse(args[0]), Int32.Parse(args[1])); }
        var input = new TextBox { Multiline = true, Dock = DockStyle.Fill };
        form.Controls.Add(input);
        var timer = new Timer { Interval = 200 };
        timer.Tick += delegate {
            ticks++;
            if (ticks == 1 || ticks == 13) {
                if (GetForegroundWindow() != form.Handle) {
                    uint foregroundPid; GetWindowThreadProcessId(GetForegroundWindow(), out foregroundPid);
                    Console.WriteLine("FAIL: Focus unavailable at tick " + ticks + ", foreground process " + System.Diagnostics.Process.GetProcessById((int)foregroundPid).ProcessName + ", handle " + GetForegroundWindow().ToInt64().ToString("X") + ".");
                    timer.Stop(); form.Close(); return;
                }
                if (ticks == 1) input.Focus();
                if (!input.Focused) { Console.WriteLine("FAIL: Test text field lost keyboard focus."); timer.Stop(); form.Close(); return; }
                Shortcut();
            }
            if (ticks > 13 && input.Text == "Aja bobad, bol. Ira jaga mulutnya.") {
                Console.WriteLine("PASS: Native global shortcut started and stopped hidden dictation; overlay preserved focus and text pasted into the original target.");
                result = 0; timer.Stop(); form.Close();
            }
            if (ticks > 70) { Console.WriteLine("FAIL: Background dictation timed out. Test field: " + input.Text); timer.Stop(); form.Close(); }
        };
        form.Shown += delegate {
            uint ignored;
            uint self = GetCurrentThreadId();
            uint foreground = GetWindowThreadProcessId(GetForegroundWindow(), out ignored);
            bool attached = foreground != 0 && foreground != self && AttachThreadInput(self, foreground, true);
            try { BringWindowToTop(form.Handle); SetForegroundWindow(form.Handle); form.Activate(); input.Focus(); }
            finally { if (attached) AttachThreadInput(self, foreground, false); }
            timer.Start();
        };
        Application.Run(form);
        timer.Dispose(); form.Dispose(); return result;
    }
}
