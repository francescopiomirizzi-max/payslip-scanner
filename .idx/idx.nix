{ pkgs, ... }: {
  # Canale stabile dei pacchetti
  channel = "stable-23.11";

  # Strumenti da installare (Google CLI e Node.js)
  packages = [
    pkgs.nodejs_20
    pkgs.google-cloud-sdk
  ];

  # Abilitiamo le estensioni, inclusa quella di Gemini per l'AI
  idx = {
    extensions = [
      "google.gemini"           # Questa è l'estensione ufficiale di Gemini
      "christian-kohler.path-intellisense"
    ];

    # Configurazione della Dashboard di IDX
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev"];
          manager = "web";
        };
      };
    };
  };
}
