using System;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;
class NativePasteSmoke {
    [STAThread]
    static int Main(string[] args) {
        if (args.Length != 1) return 2;
        int result = 1;
        var form = new Form();
        form.Text = "Cawal paste verification";
        form.StartPosition = FormStartPosition.Manual;
        form.Location = new Point(-12000, -12000);
        form.Size = new Size(300,150);
        form.ShowInTaskbar = false;
        var input = new TextBox(); input.Multiline = true; input.Dock = DockStyle.Fill;
        form.Controls.Add(input);
        var timer = new Timer(); timer.Interval = 200;
        Process helper = null;
        int ticks = 0;
        timer.Tick += delegate {
            ticks++;
            if (ticks == 1) {
                input.Focus();
                var start = new ProcessStartInfo(args[0], "paste " + form.Handle.ToInt64().ToString("X") + " " + Process.GetCurrentProcess().Id);
                start.UseShellExecute = false; start.CreateNoWindow = true;
                helper = Process.Start(start);
            }
            if (helper != null && helper.HasExited && ticks > 2) {
                if (helper.ExitCode == 0 && input.Text == "Cawal native paste test") {
                    Console.WriteLine("PASS: Native paste restored the target and inserted the clipboard text."); result = 0;
                } else Console.WriteLine("FAIL: Native paste verification (code " + helper.ExitCode + ").");
                timer.Stop(); form.Close();
            }
            if (ticks > 40) { if (helper != null && !helper.HasExited) helper.Kill(); timer.Stop(); form.Close(); }
        };
        form.Shown += delegate { timer.Start(); };
        Application.Run(form);
        timer.Dispose(); form.Dispose(); return result;
    }
}
