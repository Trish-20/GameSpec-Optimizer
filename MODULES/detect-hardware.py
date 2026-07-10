import subprocess
import cpuinfo
import json
import psutil

def get_windows_gpu(get_integrated=False):
    """Uses Windows WMIC to get graphics hardware."""
    try:
        # Queries Windows Management Instrumentation for all video controllers
        cmd = "wmic path win32_VideoController get name"
        output = subprocess.check_output(cmd, shell=True, text=True)
        devices = [line.strip() for line in output.split("\n")[1:] if line.strip()]
        
        if not devices:
            return "No Graphics Card Detected"
            
        if get_integrated:
            # Usually the first entry or entries containing Intel/AMD/Graphics
            integrated = [d for d in devices if "intel" in d.lower() or "amd" in d.lower() or "graphics" in d.lower()]
            return integrated if integrated else devices[0]
        else:
            # Usually the dedicated card (NVIDIA/Radeon RX), or falls back to first device
            dedicated = [d for d in devices if "nvidia" in d.lower() or "geforce" in d.lower() or "rtx" in d.lower() or "rad    eon rx" in d.lower()]
            return dedicated if dedicated else devices[-1]
            
    except Exception:
        return "Detection Failed"

def get_specs():
    # Fetch CPU and RAM (ram is converted from bytes to gb)
    cpu_model = cpuinfo.get_cpu_info().get('brand_raw', 'Unknown CPU')
    ram_gb = round(psutil.virtual_memory().total / (1024 ** 3), 2)

    # Pick between integrated graphics or yung gpu mismo
    # print("Which GPU type would you like to use?")
    # print("[1] Dedicated GPU")
    # print("[2] Integrated Graphics")
    # choice = input("Enter choice (1 or 2): ").strip()
    # add later pag downloadable na to

    # fallback since na comment yung selection
    choice = "1" # Default to dedicated GPU

    is_integrated = (choice == "2")
    gpu_model = get_windows_gpu(get_integrated=is_integrated)

    return {
        "cpu_model": cpu_model,
        "ram_gb": ram_gb,
        "gpu_model": gpu_model
    }

if __name__ == "__main__":
    try:
        result = get_specs()
    except Exception as e:
        result = {
            'success': False,
            'error': 'Failed to detect hardware specs',
            'detail': str(e)
        }
    
    # Output JSON result
    print(json.dumps(result))
