def extract_file_from_bundle(bundle_path, target_path):
    """
    Estrae dal bundle PressToAI il contenuto del file specificato.

    Il bundle è un normale file di testo contenente sezioni delimitate
    da marker nel formato:

        @@@ percorso/del/file @@@

    Esempio:

        @@@ rts/System/Platform/Mac/MacPresentBackend.h @@@
        1:#pragma once
        2:
        3:...
        @@@ rts/System/Platform/Mac/MacPresentBackend.mm @@@
        ...

    Args:
        bundle_path: Percorso del file bundle PressToAI.
        target_path: Percorso del file da estrarre dal bundle.

    Returns:
        Il contenuto del file estratto come stringa.

    Raises:
        FileNotFoundError: Se il bundle non esiste.
        ValueError: Se il file richiesto non viene trovato nel bundle.
    """

    content = []
    in_target = False

    # Marker esatto della sezione da estrarre
    target_marker = f"@@@ {target_path} @@@"

    with open(bundle_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            # Rimuoviamo solo il terminatore di riga per semplificare
            # il confronto dei marker.
            stripped_line = line.rstrip("\r\n")

            # Rileva l'inizio di una nuova sezione del bundle
            if stripped_line.startswith("@@@ ") and stripped_line.endswith(" @@@"):
                if in_target:
                    # Abbiamo raggiunto la sezione successiva:
                    # il file target è terminato.
                    break

                if stripped_line == target_marker:
                    in_target = True
                    continue

            if in_target:
                # Rimuove il numero di riga iniziale nel formato:
                #
                #   123:contenuto
                #
                # ma solo se la parte prima del ':' è composta
                # esclusivamente da cifre.
                if ":" in line:
                    prefix, file_content = line.split(":", 1)

                    if prefix.isdigit():
                        content.append(file_content)
                        continue

                # Riga senza prefisso numerico
                content.append(line)

    if not in_target:
        raise ValueError(
            f"File non trovato nel bundle PressToAI: {target_path}"
        )

    return "".join(content)


# ============================================================================
# CONFIGURAZIONE
# ============================================================================

# File bundle PressToAI non compresso
bundle_path = "/mnt/agents/output/RecoilEngine-AppleSilicon_full4ai.txt"

# File da estrarre dal bundle
files_to_extract = [
    "rts/System/Platform/Mac/MacPresentBackend.h",
    "rts/System/Platform/Mac/MacPresentBackend.mm",
    "rts/System/Platform/Mac/MetalPresent.h",
    "rts/System/Platform/Mac/MetalPresent.mm",
    "rts/System/Platform/Mac/WindowManagerHelper.cpp",
    "AI/Skirmish/BARb/MACOS-ARM64-FORK.md",
]


# ============================================================================
# ESTRAZIONE
# ============================================================================

extracted = {}

for file_path in files_to_extract:
    print(f"Estrazione: {file_path} ...")

    try:
        content = extract_file_from_bundle(
            bundle_path=bundle_path,
            target_path=file_path,
        )

        extracted[file_path] = content

        print(f"  -> {len(content)} caratteri")

    except FileNotFoundError:
        print(f"  -> ERRORE: bundle non trovato: {bundle_path}")

    except ValueError as e:
        print(f"  -> ERRORE: {e}")


# ============================================================================
# RISULTATO
# ============================================================================

print("\nEstrazione completata!")

print(f"File estratti con successo: {len(extracted)}/{len(files_to_extract)}")

for file_path, content in extracted.items():
    print(f"  - {file_path}: {len(content)} caratteri")
