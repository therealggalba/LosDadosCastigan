# Carpeta de Audios de Voz para Los Dados Castigan

Coloca aquí los archivos de voz grabados con los siguientes nombres en formato M4A (.m4a) o MP3 (.mp3):
- `buena_mano_es.m4a` / `buena_mano_es.mp3` - Voz en español para "¡La buena mano!"
- `buena_mano_en.m4a` / `buena_mano_en.mp3` - Voz en inglés para "Good hand!"
- `dados_castigan_es.m4a` / `dados_castigan_es.mp3` - Voz en español para "¡Los dados castigan!"
- `dados_castigan_en.m4a` / `dados_castigan_en.mp3` - Voz en inglés para "The dice punish!"

### Funcionamiento:
El juego buscará primero los archivos con extensión `.m4a`. Si no existen o fallan al reproducir, intentará cargar los archivos `.mp3`. Si ninguno se puede reproducir (o no están presentes), se utilizará de forma automática el sintetizador de voz nativo (`window.speechSynthesis`) del navegador como plan de respaldo (fallback).
