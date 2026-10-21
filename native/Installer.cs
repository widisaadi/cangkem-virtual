using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using Microsoft.Win32;

// Branded UI around the bundled NSIS engine. NSIS owns install/uninstall state;
// this launcher never reads or changes the user's application settings or key.
internal static class Installer
{
    static readonly Assembly Assembly = System.Reflection.Assembly.GetExecutingAssembly();
    static readonly string Version = ReadText("setup.version").Trim();
    static readonly string PayloadHash = ReadText("setup.sha256").Trim();
    static string temporaryDirectory;

    static string ReadText(string name)
    {
        using (var stream = Assembly.GetManifestResourceStream(name))
        using (var reader = new StreamReader(stream)) return reader.ReadToEnd();
    }

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            if (args.Any(arg => arg.Equals("/S", StringComparison.OrdinalIgnoreCase)))
            {
                string directory = FindDirectoryArgument(args) ?? DefaultDirectory();
                return Install(directory);
            }
            var app = new Application();
            app.ShutdownMode = ShutdownMode.OnMainWindowClose;
            var window = new SetupWindow(Version, DefaultDirectory());
            app.MainWindow = window;
            string preview = args.FirstOrDefault(arg => arg.StartsWith("--preview="));
            string page = args.FirstOrDefault(arg => arg.StartsWith("--page="));
            if (preview != null) window.ConfigurePreview(preview.Substring(10), page == null ? "welcome" : page.Substring(7));
            app.Run(window);
            return window.Result;
        }
        catch (Exception error)
        {
            string preview = args.FirstOrDefault(arg => arg.StartsWith("--preview="));
            if (preview != null) File.WriteAllText(preview.Substring(10) + ".error.txt", error.ToString());
            else if (!args.Any(arg => arg.Equals("/S", StringComparison.OrdinalIgnoreCase)))
                MessageBox.Show(error.Message, "Cawal Setup", MessageBoxButton.OK, MessageBoxImage.Error);
            return 1;
        }
        finally { Cleanup(); }
    }

    static string FindDirectoryArgument(string[] args)
    {
        int index = Array.FindIndex(args, arg => arg.StartsWith("/D=", StringComparison.OrdinalIgnoreCase));
        return index < 0 ? null : string.Join(" ", args.Skip(index)).Substring(3).Trim('"');
    }

    public static string DefaultDirectory()
    {
        // Respect the actual install location when updating an existing copy.
        foreach (RegistryKey root in new[] { Registry.CurrentUser, Registry.LocalMachine })
        using (var uninstall = root.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall"))
        {
            if (uninstall == null) continue;
            foreach (string name in uninstall.GetSubKeyNames())
            using (var entry = uninstall.OpenSubKey(name))
            {
                if (entry == null) continue;
                string displayName = entry.GetValue("DisplayName") as string;
                if (displayName != "Cawal" && (displayName == null || !displayName.StartsWith("Cawal ", StringComparison.Ordinal))) continue;
                string path = entry.GetValue("InstallLocation") as string;
                if (string.IsNullOrWhiteSpace(path))
                using (var install = root.OpenSubKey(@"Software\" + name)) path = install == null ? null : install.GetValue("InstallLocation") as string;
                if (!string.IsNullOrWhiteSpace(path) && File.Exists(Path.Combine(path, "Cawal.exe"))) return path.TrimEnd('\\');
            }
        }
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Cawal");
    }

    public static string ValidateDirectory(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || !Path.IsPathRooted(value) || Path.GetPathRoot(value).Length < 3 || value.IndexOfAny(new[] { '"', '\r', '\n' }) >= 0)
            throw new InvalidOperationException("Choose a valid, full installation path.");
        string path = Path.GetFullPath(value).TrimEnd('\\');
        if (path.Equals(Path.GetPathRoot(path).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Choose a folder, not the root of a drive.");
        string windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows).TrimEnd('\\');
        if (path.Equals(windows, StringComparison.OrdinalIgnoreCase) || path.StartsWith(windows + "\\", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Choose a folder outside the Windows system directory.");
        if (File.Exists(path)) throw new InvalidOperationException("This path is a file. Choose a folder instead.");
        return path;
    }

    public static int Install(string directory)
    {
        directory = ValidateDirectory(directory);
        temporaryDirectory = Path.Combine(Path.GetTempPath(), "CawalSetup-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temporaryDirectory);
        string payload = Path.Combine(temporaryDirectory, "Cawal-install.exe");
        using (var resource = Assembly.GetManifestResourceStream("setup.payload"))
        using (var output = File.Create(payload)) resource.CopyTo(output);
        using (var hash = SHA256.Create())
        using (var file = File.OpenRead(payload))
        {
            string actual = BitConverter.ToString(hash.ComputeHash(file)).Replace("-", "").ToLowerInvariant();
            if (!actual.Equals(PayloadHash, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("The installer is damaged. Download Cawal Setup again.");
        }
        var info = new ProcessStartInfo(payload, "/S /D=" + directory) {
            UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden
        };
        using (var process = Process.Start(info))
        {
            process.WaitForExit();
            if (process.ExitCode != 0) return process.ExitCode;
        }
        string executable = Path.Combine(directory, "Cawal.exe");
        if (!File.Exists(executable) || !FileVersionInfo.GetVersionInfo(executable).ProductVersion.StartsWith(Version, StringComparison.Ordinal))
            throw new InvalidOperationException("Installation did not finish. Check the folder permissions and try again.");
        return 0;
    }

    public static void Cleanup()
    {
        if (temporaryDirectory == null) return;
        try { Directory.Delete(temporaryDirectory, true); } catch { /* Windows may still be releasing the installer. */ }
        temporaryDirectory = null;
    }

    public static Stream Resource(string name) { return Assembly.GetManifestResourceStream(name); }
}

internal sealed class SetupWindow : Window
{
    readonly string version;
    string installDirectory;
    int page;
    bool installing;
    bool previewMode;
    public int Result { get; private set; }
    readonly TextBlock heading, description, error, eyebrow, footer, progressText;
    readonly Button primary, back, close;
    readonly StackPanel welcome, location, complete;
    readonly Grid progress;
    readonly TextBox directory;
    readonly Image logo;
    readonly Border content;

    const string Xaml = @"
<Grid xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'>
 <Grid.Resources>
  <SolidColorBrush x:Key='Accent' Color='#FFDD33'/>
  <Style TargetType='Button'>
   <Setter Property='Foreground' Value='#F1F2EE'/><Setter Property='Background' Value='#282F31'/><Setter Property='BorderBrush' Value='#465154'/>
   <Setter Property='BorderThickness' Value='1'/><Setter Property='Padding' Value='20,12'/><Setter Property='Cursor' Value='Hand'/><Setter Property='FontSize' Value='13'/>
   <Setter Property='Template'><Setter.Value><ControlTemplate TargetType='Button'>
    <Border x:Name='Surface' Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}' BorderThickness='{TemplateBinding BorderThickness}' CornerRadius='9' Padding='{TemplateBinding Padding}'>
     <ContentPresenter HorizontalAlignment='Center' VerticalAlignment='Center'/>
    </Border>
    <ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter TargetName='Surface' Property='Opacity' Value='0.83'/></Trigger>
     <Trigger Property='IsKeyboardFocused' Value='True'><Setter TargetName='Surface' Property='BorderBrush' Value='#FFDD33'/><Setter TargetName='Surface' Property='BorderThickness' Value='2'/></Trigger>
     <Trigger Property='IsEnabled' Value='False'><Setter TargetName='Surface' Property='Opacity' Value='0.45'/></Trigger>
    </ControlTemplate.Triggers>
   </ControlTemplate></Setter.Value></Setter>
  </Style>
  <Style TargetType='TextBlock'><Setter Property='Foreground' Value='#F1F2EE'/><Setter Property='TextWrapping' Value='Wrap'/></Style>
 </Grid.Resources>
 <Border CornerRadius='18' BorderBrush='#3A4345' BorderThickness='1' Background='#171A1B'>
  <Grid>
   <Grid.RowDefinitions><RowDefinition Height='58'/><RowDefinition Height='*'/><RowDefinition Height='72'/></Grid.RowDefinitions>
   <Border BorderBrush='#303739' BorderThickness='0,0,0,1' Background='#1D2223' CornerRadius='18,18,0,0'>
    <Grid x:Name='Titlebar' Margin='24,0,16,0'>
     <StackPanel Orientation='Horizontal' VerticalAlignment='Center'><TextBlock Text='Cawal' FontSize='20' FontWeight='SemiBold'/><TextBlock Text=' /  Setup' FontSize='13' Foreground='#A9B3B6' VerticalAlignment='Center' Margin='10,2,0,0'/></StackPanel>
     <Button x:Name='Close' Content='&#x2715;' HorizontalAlignment='Right' Padding='12,7' Background='Transparent' BorderThickness='0' AutomationProperties.Name='Close setup'/>
    </Grid>
   </Border>
   <Grid Grid.Row='1' Margin='0'>
    <Grid.ColumnDefinitions><ColumnDefinition Width='230'/><ColumnDefinition Width='*'/></Grid.ColumnDefinitions>
    <Border Background='#1C2122' BorderBrush='#303739' BorderThickness='0,0,1,0'>
     <Grid Margin='27,32'>
      <Grid.RowDefinitions><RowDefinition Height='Auto'/><RowDefinition Height='*'/><RowDefinition Height='Auto'/></Grid.RowDefinitions>
      <StackPanel><Image x:Name='Logo' Width='82' Height='48' Stretch='Uniform' HorizontalAlignment='Left' Margin='0,0,0,26'/>
       <TextBlock Text='Less typing.' FontSize='23' FontWeight='SemiBold' LineHeight='31'/>
       <TextBlock Text='More flow.' FontSize='23' FontWeight='SemiBold' LineHeight='31' Foreground='#FFDD33'/>
       <TextBlock Text='Your Windows voice companion.' FontSize='12' Foreground='#A9B3B6' Margin='0,17,0,0' LineHeight='21'/>
      </StackPanel>
      <StackPanel Grid.Row='2'><TextBlock Text='WINDOWS  /  64-BIT' FontSize='10' Foreground='#899598'/><TextBlock x:Name='Version' FontSize='11' Foreground='#A9B3B6' Margin='0,8,0,0'/></StackPanel>
     </Grid>
    </Border>
    <Border x:Name='Content' Grid.Column='1' Padding='32,35,32,20'>
     <Grid>
      <Grid.RowDefinitions><RowDefinition Height='Auto'/><RowDefinition Height='Auto'/><RowDefinition Height='Auto'/><RowDefinition Height='*'/><RowDefinition Height='Auto'/></Grid.RowDefinitions>
      <TextBlock x:Name='Eyebrow' Foreground='#FFDD33' FontSize='10' FontWeight='SemiBold' Margin='0,0,0,13'/>
      <TextBlock x:Name='Heading' Grid.Row='1' FontSize='29' FontWeight='SemiBold' LineHeight='37'/>
      <TextBlock x:Name='Description' Grid.Row='2' Foreground='#A9B3B6' FontSize='13' LineHeight='21' Margin='0,12,0,0'/>
      <Grid Grid.Row='3' Margin='0,22,0,0'>
       <StackPanel x:Name='Welcome'>
        <Border Background='#222829' BorderBrush='#353F41' BorderThickness='1' CornerRadius='12' Padding='18'>
         <StackPanel><TextBlock Text='Speak. Press. Keep building.' FontSize='15' FontWeight='SemiBold'/><TextBlock Text='Voice dictation, a shortcut away.' Foreground='#A9B3B6' FontSize='12' Margin='0,8,0,0'/>
          <StackPanel Orientation='Horizontal' Margin='0,17,0,0'>
           <Border Background='#333B3E' BorderBrush='#566165' BorderThickness='1' CornerRadius='6' Padding='13,8'><TextBlock Text='Ctrl' FontWeight='SemiBold'/></Border>
           <TextBlock Text=' + ' VerticalAlignment='Center' Foreground='#A9B3B6' Margin='5,0'/>
           <Border Background='#333B3E' BorderBrush='#566165' BorderThickness='1' CornerRadius='6' Padding='13,8'><TextBlock Text='Shift' FontWeight='SemiBold'/></Border>
           <TextBlock Text=' + ' VerticalAlignment='Center' Foreground='#A9B3B6' Margin='5,0'/>
           <Border Background='#333B3E' BorderBrush='#566165' BorderThickness='1' CornerRadius='6' Padding='13,8'><TextBlock Text='Space' FontWeight='SemiBold'/></Border>
          </StackPanel>
         </StackPanel>
        </Border>
        <TextBlock Text='Bring your Groq API key. Set up your shortcut after installation.' FontSize='11' Foreground='#A9B3B6' Margin='0,15,0,0' LineHeight='19'/>
       </StackPanel>
       <StackPanel x:Name='Location' Visibility='Collapsed'>
        <TextBlock Text='Installation folder' FontSize='12' Margin='0,0,0,9'/>
        <Border Background='#252C2E' BorderBrush='#566165' BorderThickness='1' CornerRadius='8' Padding='12,10'>
         <TextBox x:Name='Directory' Background='Transparent' Foreground='#F1F2EE' BorderThickness='0' FontSize='12' CaretBrush='#FFDD33' AutomationProperties.Name='Installation folder'/>
        </Border>
        <Button x:Name='Browse' Content='Choose folder' HorizontalAlignment='Left' Margin='0,12,0,0' Padding='14,9'/>
        <TextBlock Text='Your API key and preferences stay on this device when updating.' Foreground='#A9B3B6' FontSize='12' Margin='0,22,0,0' LineHeight='21'/>
        <Button x:Name='License' Content='MIT License' HorizontalAlignment='Left' Background='Transparent' BorderThickness='0' Foreground='#FFDD33' Padding='0,10'/>
       </StackPanel>
       <Grid x:Name='Progress' Visibility='Collapsed' VerticalAlignment='Center'>
        <StackPanel><TextBlock x:Name='ProgressText' Text='Installing application files…' FontSize='15'/>
         <ProgressBar x:Name='InstallProgress' Height='7' Margin='0,20,0,0' IsIndeterminate='True' Foreground='#FFDD33' Background='#30383A' BorderThickness='0'/>
         <TextBlock Text='This may take a moment. Please keep this window open.' FontSize='12' Foreground='#A9B3B6' Margin='0,16,0,0' LineHeight='21'/>
        </StackPanel>
       </Grid>
       <StackPanel x:Name='Complete' Visibility='Collapsed'>
        <Border Background='#222829' BorderBrush='#3E484B' BorderThickness='1' CornerRadius='12' Padding='20'>
         <StackPanel><TextBlock Text='Next, make it yours.' FontSize='17' FontWeight='SemiBold'/><TextBlock Text='Connect Groq, choose your shortcut, and try dictation. Your existing API key and preferences are preserved.' Foreground='#A9B3B6' FontSize='12' Margin='0,10,0,0' LineHeight='21'/></StackPanel>
        </Border>
       </StackPanel>
      </Grid>
      <TextBlock x:Name='Error' Grid.Row='4' Foreground='#FFDD33' FontSize='12' LineHeight='19' Margin='0,10,0,0' AutomationProperties.LiveSetting='Assertive'/>
     </Grid>
    </Border>
   </Grid>
   <Border Grid.Row='2' BorderBrush='#303739' BorderThickness='0,1,0,0'>
    <Grid Margin='24,0'>
     <TextBlock x:Name='Footer' VerticalAlignment='Center' Foreground='#899598' FontSize='11'/>
     <StackPanel Orientation='Horizontal' HorizontalAlignment='Right' VerticalAlignment='Center'>
      <Button x:Name='Back' Content='Back' Background='Transparent' BorderThickness='0' Margin='0,0,12,0' Visibility='Collapsed'/>
      <Button x:Name='Primary' Content='Get started' Background='#FFDD33' Foreground='#171A1B' BorderBrush='#FFDD33' FontWeight='SemiBold' MinWidth='132'/>
     </StackPanel>
    </Grid>
   </Border>
  </Grid>
 </Border>
</Grid>";

    T Find<T>(string name) where T : class { return ((FrameworkElement)Content).FindName(name) as T; }
    public SetupWindow(string appVersion, string target)
    {
        version = appVersion; installDirectory = target;
        Title = "Cawal Setup"; Width = 850; Height = 620; ResizeMode = ResizeMode.NoResize;
        WindowStyle = WindowStyle.None; AllowsTransparency = true; Background = Brushes.Transparent;
        WindowStartupLocation = WindowStartupLocation.CenterScreen; FontFamily = new FontFamily("Segoe UI");
        Content = XamlReader.Parse(Xaml);
        heading = Find<TextBlock>("Heading"); description = Find<TextBlock>("Description"); eyebrow = Find<TextBlock>("Eyebrow");
        error = Find<TextBlock>("Error"); footer = Find<TextBlock>("Footer"); progressText = Find<TextBlock>("ProgressText");
        primary = Find<Button>("Primary"); back = Find<Button>("Back"); close = Find<Button>("Close");
        welcome = Find<StackPanel>("Welcome"); location = Find<StackPanel>("Location"); complete = Find<StackPanel>("Complete");
        progress = Find<Grid>("Progress"); directory = Find<TextBox>("Directory"); logo = Find<Image>("Logo"); content = Find<Border>("Content");
        Find<TextBlock>("Version").Text = "Cawal " + version;
        directory.Text = target;
        using (var stream = Installer.Resource("setup.logo"))
        {
            var image = new BitmapImage(); image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad; image.StreamSource = stream; image.EndInit();
            // The source logo has generous transparent margins. Trim those at
            // render time so the visible mark aligns with the text beneath it.
            var pixels = new FormatConvertedBitmap(image, PixelFormats.Bgra32, null, 0);
            int stride = pixels.PixelWidth * 4;
            var bytes = new byte[stride * pixels.PixelHeight]; pixels.CopyPixels(bytes, stride, 0);
            int left = pixels.PixelWidth, top = pixels.PixelHeight, right = 0, bottom = 0;
            for (int y = 0; y < pixels.PixelHeight; y++) for (int x = 0; x < pixels.PixelWidth; x++)
                if (bytes[y * stride + x * 4 + 3] > 40) { left = Math.Min(left, x); top = Math.Min(top, y); right = Math.Max(right, x); bottom = Math.Max(bottom, y); }
            logo.Source = left < right && top < bottom ? new CroppedBitmap(image, new Int32Rect(left, top, right - left + 1, bottom - top + 1)) : (BitmapSource)image;
        }
        primary.Click += async (sender, args) => await Next();
        back.Click += (sender, args) => { if (!installing) SetPage(0); };
        close.Click += (sender, args) => Close();
        Find<Grid>("Titlebar").MouseLeftButtonDown += (sender, args) => { if (args.OriginalSource is TextBlock || args.OriginalSource is Grid) DragMove(); };
        Find<Button>("Browse").Click += (sender, args) => Browse();
        Find<Button>("License").Click += (sender, args) => ShowLicense();
        Closing += (sender, args) => { if (installing) args.Cancel = true; };
        Loaded += (sender, args) => { Animate(); primary.Focus(); };
        SetPage(0);
    }

    void Animate()
    {
        if (!SystemParameters.ClientAreaAnimation) return;
        content.BeginAnimation(OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(240)));
        logo.BeginAnimation(OpacityProperty, new DoubleAnimation(0.2, 1, TimeSpan.FromMilliseconds(600)));
    }

    void SetPage(int next)
    {
        page = next; error.Text = "";
        welcome.Visibility = next == 0 ? Visibility.Visible : Visibility.Collapsed;
        location.Visibility = next == 1 ? Visibility.Visible : Visibility.Collapsed;
        progress.Visibility = next == 2 ? Visibility.Visible : Visibility.Collapsed;
        complete.Visibility = next == 3 ? Visibility.Visible : Visibility.Collapsed;
        back.Visibility = next == 1 ? Visibility.Visible : Visibility.Collapsed;
        primary.IsEnabled = next != 2; close.IsEnabled = next != 2;
        eyebrow.Text = next == 0 ? "WELCOME TO CAWAL" : next == 1 ? "MAKE YOURSELF AT HOME" : next == 2 ? "SETTING THINGS UP" : "ALL SET";
        heading.Text = next == 0 ? "Pake Cangkem Virtual ,\nBuild Aplikasi 2.5x Lebih Cepat" : next == 1 ? "Choose your space." : next == 2 ? "Making room for your voice." : "Cawal is installed.";
        if (next == 0) heading.FontSize = 25; else heading.FontSize = 29;
        description.Text = next == 0 ? "Less typing. More creating. Let your voice do the work." : next == 1 ? "Install Cawal for your Windows account." : next == 2 ? "Installing Cawal " + version + ". Your preferences will be preserved." : "Continue to your Groq API key and dictation setup.";
        primary.Content = next == 0 ? "Get started" : next == 1 ? "Install Cawal" : next == 2 ? "Installing…" : "Continue setup";
        footer.Text = next == 0 ? "Welcome" : next == 1 ? "Install, then connect Groq" : next == 2 ? "Next: Groq API key" : "Next: Groq API key";
        Animate();
    }

    async Task Next()
    {
        if (installing) return;
        if (page == 0) { SetPage(1); directory.Focus(); return; }
        if (page == 3)
        {
            LaunchSetup();
            return;
        }
        try
        {
            installDirectory = Installer.ValidateDirectory(directory.Text);
            if (previewMode) { SetPage(3); return; }
            installing = true; SetPage(2);
            int code = await Task.Run(() => Installer.Install(installDirectory));
            if (code != 0) throw new InvalidOperationException("Setup returned code " + code + ". Close Cawal and try again, or choose a folder you can write to.");
            installing = false; SetPage(3); LaunchSetup();
        }
        catch (Exception ex) { installing = false; SetPage(1); error.Text = ex.Message; }
        finally { Installer.Cleanup(); }
    }

    void LaunchSetup()
    {
        try { Process.Start(new ProcessStartInfo(Path.Combine(installDirectory, "Cawal.exe"), "--show --setup-after-install") { UseShellExecute = true }); Close(); }
        catch (Exception ex) { error.Text = "Setup could not open: " + ex.Message + " Select Continue setup to try again."; }
    }

    void Browse()
    {
        using (var dialog = new System.Windows.Forms.FolderBrowserDialog())
        {
            dialog.Description = "Choose where to install Cawal"; dialog.SelectedPath = directory.Text;
            if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK) directory.Text = dialog.SelectedPath;
        }
    }

    void ShowLicense()
    {
        var text = new TextBox { Text = ReadLicense(), IsReadOnly = true, TextWrapping = TextWrapping.Wrap,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Padding = new Thickness(22),
            Background = new SolidColorBrush(Color.FromRgb(23, 26, 27)), Foreground = Brushes.White,
            BorderThickness = new Thickness(0), FontSize = 13 };
        new Window { Owner = this, Title = "Cawal · MIT License", Width = 650, Height = 470,
            WindowStartupLocation = WindowStartupLocation.CenterOwner, Content = text }.ShowDialog();
    }
    string ReadLicense() { using (var reader = new StreamReader(Installer.Resource("setup.license"))) return reader.ReadToEnd(); }

    public void ConfigurePreview(string path, string targetPage)
    {
        previewMode = true;
        ContentRendered += async (sender, args) => {
            try
            {
                if (targetPage == "flow")
                {
                    await Next();
                    if (page != 1) throw new Exception("Welcome did not advance to the folder page.");
                    string original = directory.Text;
                    directory.Text = Path.GetPathRoot(original);
                    await Next();
                    if (page != 1 || string.IsNullOrEmpty(error.Text)) throw new Exception("A drive root was not rejected.");
                    directory.Text = original;
                    await Next();
                    if (page != 3 || !primary.IsEnabled) throw new Exception("Completion controls are unavailable.");
                }
                else SetPage(targetPage == "location" ? 1 : targetPage == "installing" ? 2 : targetPage == "complete" ? 3 : 0);
                await Task.Delay(800);
                var bitmap = new RenderTargetBitmap((int)ActualWidth, (int)ActualHeight, 96, 96, PixelFormats.Pbgra32);
                bitmap.Render(this);
                var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
                using (var file = File.Create(path)) encoder.Save(file);
            }
            catch (Exception ex) { Result = 1; File.WriteAllText(path + ".error.txt", ex.ToString()); }
            Close();
        };
    }
}
