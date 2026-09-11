using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using AxZKFPEngXControl;

namespace ZkEngxBridge
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new BridgeForm());
        }
    }

    sealed class BridgeForm : Form
    {
        readonly AxZKFPEngX _eng = new AxZKFPEngX();
        readonly TcpListener _tcp = new TcpListener(IPAddress.Loopback, 18765);
        readonly object _gate = new object();
        string _lastTemplate;
        int _lastQuality;
        bool _engineOk;
        string _sn = "";
        ManualResetEventSlim _captureWait;
        volatile bool _running = true;
        string _pendingBody = "";

        public BridgeForm()
        {
            Text = "ZK9500 EngX Bridge";
            Width = 480;
            Height = 140;
            FormBorderStyle = FormBorderStyle.FixedToolWindow;
            ShowInTaskbar = true;
            StartPosition = FormStartPosition.CenterScreen;
            Controls.Add(_eng);
            _eng.Dock = DockStyle.Fill;
            _eng.Visible = true;
            Shown += OnShown;
            FormClosing += (_, __) => Shutdown();
        }

        void OnShown(object sender, EventArgs e)
        {
            try
            {
                if (!_eng.Created) _eng.CreateControl();
                _eng.OnCapture += Eng_OnCapture;
                _eng.OnFeatureInfo += Eng_OnFeatureInfo;
                int rc = _eng.InitEngine();
                if (rc != 0)
                {
                    Text = "ZK InitEngine=" + rc + " — branchez ZK9500";
                    _engineOk = false;
                }
                else
                {
                    _engineOk = true;
                    _sn = Convert.ToString(_eng.SensorSN) ?? "";
                    try { _eng.FPEngineVersion = "9"; } catch { }
                    if (_eng.IsRegister) _eng.CancelEnroll();
                    _eng.BeginCapture();
                    Text = "ZK9500 OK SN=" + _sn + " | http://127.0.0.1:18765";
                }
            }
            catch (Exception ex)
            {
                Text = "Erreur: " + ex.Message;
                _engineOk = false;
            }

            try
            {
                _tcp.Start();
                ThreadPool.QueueUserWorkItem(_ => AcceptLoop());
            }
            catch (Exception ex)
            {
                Text = (Text + " | Port: " + ex.Message).Trim();
            }
        }

        void Eng_OnFeatureInfo(object sender, IZKFPEngXEvents_OnFeatureInfoEvent e)
        {
            try { _lastQuality = e.aQuality; } catch { }
        }

        void Eng_OnCapture(object sender, IZKFPEngXEvents_OnCaptureEvent e)
        {
            try
            {
                File.AppendAllText(
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "zk_capture.log"),
                    DateTime.Now.ToString("o") + " actionResult=" + e.actionResult + "\r\n");
                if (!e.actionResult) return;
                string tpl = _eng.EncodeTemplate1(e.aTemplate);
                File.AppendAllText(
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "zk_capture.log"),
                    " template_len=" + (tpl == null ? 0 : tpl.Length) + "\r\n");
                if (string.IsNullOrEmpty(tpl)) return;
                lock (_gate) { _lastTemplate = tpl; }
                var w = _captureWait;
                if (w != null) w.Set();
            }
            catch (Exception ex)
            {
                try
                {
                    File.AppendAllText(
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "zk_capture.log"),
                        "ERR " + ex.Message + "\r\n");
                }
                catch { }
            }
        }

        void AcceptLoop()
        {
            while (_running)
            {
                try
                {
                    var client = _tcp.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(__ => Serve(client));
                }
                catch
                {
                    if (!_running) break;
                }
            }
        }

        void Serve(TcpClient client)
        {
            try
            {
                using (client)
                using (var stream = client.GetStream())
                {
                    stream.ReadTimeout = 35000;
                    stream.WriteTimeout = 35000;
                    var req = ReadRequest(stream);
                    if (req == null) return;
                    string method = req.Item1;
                    string path = req.Item2.ToLowerInvariant();
                    string body = req.Item3;

                    if (method == "OPTIONS")
                    {
                        WriteResponse(stream, 204, "text/plain", "");
                        return;
                    }
                    if (path.StartsWith("/health") && method == "GET")
                    {
                        WriteResponse(stream, 200, "application/json", HealthJson());
                        return;
                    }
                    if (path.StartsWith("/capture") && method == "POST")
                    {
                        int code = RunCapture(body);
                        WriteResponse(stream, code, "application/json", _pendingBody);
                        return;
                    }
                    if (path.StartsWith("/verify") && method == "POST")
                    {
                        int code = RunVerify(body);
                        WriteResponse(stream, code, "application/json", _pendingBody);
                        return;
                    }
                    WriteResponse(stream, 404, "application/json", "{\"detail\":\"not found\"}");
                }
            }
            catch { }
        }

        int RunCapture(string body)
        {
            if (!_engineOk)
            {
                _pendingBody = "{\"ok\":false,\"detail\":\"Moteur ZKFPEngX non initialisé\"}";
                return 503;
            }
            int timeoutMs = 25000;
            try
            {
                int i = (body ?? "").IndexOf("timeout_ms", StringComparison.OrdinalIgnoreCase);
                if (i >= 0)
                {
                    var digits = new StringBuilder();
                    for (int j = i; j < body.Length; j++)
                    {
                        char c = body[j];
                        if (char.IsDigit(c)) digits.Append(c);
                        else if (digits.Length > 0) break;
                    }
                    if (digits.Length > 0) timeoutMs = int.Parse(digits.ToString());
                }
            }
            catch { }

            lock (_gate) { _lastTemplate = null; }
            _captureWait = new ManualResetEventSlim(false);
            // Ne pas CancelCapture — le moteur reste en écoute continue (BeginCapture au démarrage).
            // Un template déjà capturé juste avant est ignoré (on a vidé _lastTemplate).

            bool ok = _captureWait.Wait(timeoutMs);
            string tpl;
            lock (_gate) { tpl = _lastTemplate; }
            if (!ok || string.IsNullOrEmpty(tpl))
            {
                _pendingBody = "{\"ok\":false,\"demo\":false,\"detail\":\"Aucune empreinte — posez le doigt sur le ZK9500. timeout="
                    + timeoutMs + "\"}";
                return 408;
            }

            byte[] raw = Encoding.UTF8.GetBytes(tpl);
            string b64 = Convert.ToBase64String(raw);
            string sha;
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
                sha = BitConverter.ToString(sha256.ComputeHash(raw)).Replace("-", "").ToLowerInvariant();

            _pendingBody = "{"
                + "\"ok\":true,\"demo\":false,\"device\":\"ZK9500\","
                + "\"algorithm\":\"zkfinger-engx-v9\","
                + "\"finger_position\":\"INDEX_DROIT\","
                + "\"quality_score\":" + (_lastQuality > 0 ? _lastQuality : 80) + ","
                + "\"template_b64\":" + JsonStr(b64) + ","
                + "\"template_sha256\":" + JsonStr(sha) + ","
                + "\"template_size\":" + raw.Length + ","
                + "\"sensor_sn\":" + JsonStr(_sn) + ","
                + "\"note\":\"Capture réelle ZK9500 (ZKFPEngX).\""
                + "}";
            return 200;
        }

        int RunVerify(string body)
        {
            if (!_engineOk)
            {
                _pendingBody = "{\"ok\":false,\"detail\":\"Moteur non initialisé\"}";
                return 503;
            }
            // body: {"probe":"<engx str>","gallery":["...","..."]}  OR probe_b64/gallery_b64
            string probe = ExtractJsonString(body, "probe");
            if (string.IsNullOrEmpty(probe))
            {
                string b64 = ExtractJsonString(body, "probe_b64");
                if (!string.IsNullOrEmpty(b64))
                {
                    try { probe = Encoding.UTF8.GetString(Convert.FromBase64String(b64)); }
                    catch { probe = null; }
                }
            }
            if (string.IsNullOrEmpty(probe))
            {
                _pendingBody = "{\"ok\":false,\"detail\":\"probe manquant\"}";
                return 400;
            }

            var scores = new System.Collections.Generic.List<string>();
            int bestIdx = -1;
            bool bestMatch = false;
            // naive parse gallery array of strings
            var gallery = ExtractJsonStringArray(body, "gallery");
            if (gallery.Count == 0)
            {
                var galleryB64 = ExtractJsonStringArray(body, "gallery_b64");
                foreach (var g in galleryB64)
                {
                    try { gallery.Add(Encoding.UTF8.GetString(Convert.FromBase64String(g))); }
                    catch { }
                }
            }

            for (int i = 0; i < gallery.Count; i++)
            {
                string g = gallery[i];
                bool matched = false;
                try
                {
                    string probeLocal = probe;
                    Invoke(new Action(() =>
                    {
                        try
                        {
                            string reg = g;
                            bool changed = false;
                            matched = _eng.VerFingerFromStr(ref reg, probeLocal, false, ref changed);
                        }
                        catch { matched = false; }
                    }));
                }
                catch { matched = false; }
                double score = matched ? 1.0 : 0.0;
                scores.Add(score.ToString(System.Globalization.CultureInfo.InvariantCulture));
                if (matched && !bestMatch)
                {
                    bestMatch = true;
                    bestIdx = i;
                }
            }

            _pendingBody = "{"
                + "\"ok\":true,\"matched\":" + (bestMatch ? "true" : "false") + ","
                + "\"best_index\":" + bestIdx + ","
                + "\"scores\":[" + string.Join(",", scores) + "]"
                + "}";
            return 200;
        }

        static string ExtractJsonString(string json, string key)
        {
            if (string.IsNullOrEmpty(json)) return null;
            string pattern = "\"" + key + "\"";
            int i = json.IndexOf(pattern, StringComparison.OrdinalIgnoreCase);
            if (i < 0) return null;
            int colon = json.IndexOf(':', i);
            if (colon < 0) return null;
            int q1 = json.IndexOf('"', colon + 1);
            if (q1 < 0) return null;
            var sb = new StringBuilder();
            for (int j = q1 + 1; j < json.Length; j++)
            {
                char c = json[j];
                if (c == '\\' && j + 1 < json.Length) { sb.Append(json[j + 1]); j++; continue; }
                if (c == '"') break;
                sb.Append(c);
            }
            return sb.ToString();
        }

        static System.Collections.Generic.List<string> ExtractJsonStringArray(string json, string key)
        {
            var list = new System.Collections.Generic.List<string>();
            if (string.IsNullOrEmpty(json)) return list;
            string pattern = "\"" + key + "\"";
            int i = json.IndexOf(pattern, StringComparison.OrdinalIgnoreCase);
            if (i < 0) return list;
            int lb = json.IndexOf('[', i);
            int rb = json.IndexOf(']', lb + 1);
            if (lb < 0 || rb < 0) return list;
            string inner = json.Substring(lb + 1, rb - lb - 1);
            int pos = 0;
            while (pos < inner.Length)
            {
                int q1 = inner.IndexOf('"', pos);
                if (q1 < 0) break;
                var sb = new StringBuilder();
                int j = q1 + 1;
                for (; j < inner.Length; j++)
                {
                    char c = inner[j];
                    if (c == '\\' && j + 1 < inner.Length) { sb.Append(inner[j + 1]); j++; continue; }
                    if (c == '"') break;
                    sb.Append(c);
                }
                list.Add(sb.ToString());
                pos = j + 1;
            }
            return list;
        }

        string HealthJson()
        {
            return "{"
                + "\"status\":\"ok\","
                + "\"device_hint\":\"ZK9500\","
                + "\"demo\":false,"
                + "\"sdk_loaded\":" + (_engineOk ? "true" : "false") + ","
                + "\"engine\":\"ZKFPEngX\","
                + "\"device_count\":" + (_engineOk ? "1" : "0") + ","
                + "\"sensor_sn\":" + JsonStr(_sn)
                + "}";
        }

        static Tuple<string, string, string> ReadRequest(NetworkStream stream)
        {
            var ms = new MemoryStream();
            var buf = new byte[4096];
            int n;
            while ((n = stream.Read(buf, 0, buf.Length)) > 0)
            {
                ms.Write(buf, 0, n);
                var all = ms.ToArray();
                int headerEnd = IndexOfHeaderEnd(all);
                if (headerEnd < 0)
                {
                    if (ms.Length > 1024 * 1024) break;
                    continue;
                }
                string headerText = Encoding.ASCII.GetString(all, 0, headerEnd);
                string[] lines = headerText.Split(new[] { "\r\n" }, StringSplitOptions.None);
                string[] parts = lines[0].Split(' ');
                string method = parts[0];
                string path = parts.Length > 1 ? parts[1] : "/";
                int contentLength = 0;
                foreach (var line in lines)
                {
                    if (line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
                        int.TryParse(line.Substring(15).Trim(), out contentLength);
                }
                int bodyStart = headerEnd + 4;
                while (all.Length - bodyStart < contentLength)
                {
                    n = stream.Read(buf, 0, buf.Length);
                    if (n <= 0) break;
                    ms.Write(buf, 0, n);
                    all = ms.ToArray();
                }
                string body = contentLength > 0
                    ? Encoding.UTF8.GetString(all, bodyStart, Math.Min(contentLength, all.Length - bodyStart))
                    : "";
                return Tuple.Create(method, path, body);
            }
            return null;
        }

        static int IndexOfHeaderEnd(byte[] data)
        {
            for (int i = 0; i + 3 < data.Length; i++)
                if (data[i] == 13 && data[i + 1] == 10 && data[i + 2] == 13 && data[i + 3] == 10)
                    return i;
            return -1;
        }

        static void WriteResponse(Stream stream, int code, string contentType, string body)
        {
            if (body == null) body = "";
            byte[] data = Encoding.UTF8.GetBytes(body);
            string reason = code == 200 ? "OK" : (code == 204 ? "No Content" : "Error");
            var sb = new StringBuilder();
            sb.Append("HTTP/1.1 ").Append(code).Append(' ').Append(reason).Append("\r\n");
            sb.Append("Content-Type: ").Append(contentType).Append("\r\n");
            sb.Append("Content-Length: ").Append(data.Length).Append("\r\n");
            sb.Append("Access-Control-Allow-Origin: *\r\n");
            sb.Append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
            sb.Append("Access-Control-Allow-Headers: Content-Type\r\n");
            sb.Append("Connection: close\r\n\r\n");
            byte[] header = Encoding.ASCII.GetBytes(sb.ToString());
            stream.Write(header, 0, header.Length);
            if (data.Length > 0) stream.Write(data, 0, data.Length);
            stream.Flush();
        }

        static string JsonStr(string s)
        {
            if (s == null) return "null";
            return "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
        }

        void Shutdown()
        {
            _running = false;
            try { _tcp.Stop(); } catch { }
            try
            {
                if (_eng != null)
                {
                    _eng.CancelCapture();
                    _eng.EndEngine();
                }
            }
            catch { }
        }
    }
}
