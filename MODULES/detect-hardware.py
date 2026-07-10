import ctypes
import json
import platform
import subprocess


def run_wmic_query(query):
    try:
        output = subprocess.check_output(query, shell=True, text=True, stderr=subprocess.DEVNULL)
        lines = [line.strip() for line in output.splitlines() if line.strip()]
        return lines[1:] if len(lines) > 1 else []
    except Exception:
        return []

def get_windows_gpu(get_integrated=False):
    """Uses Windows WMIC to get graphics hardware."""
    try:
        # Queries Windows Management Instrumentation for all video controllers
        devices = run_wmic_query("wmic path win32_VideoController get name")
        
        if not devices:
            return "No Graphics Card Detected"
            
        if get_integrated:
            # Usually the first entry or entries containing Intel/AMD/Graphics
            integrated = [d for d in devices if "intel" in d.lower() or "amd" in d.lower() or "graphics" in d.lower()]
            return integrated[0] if integrated else devices[0]
        else:
            # Usually the dedicated card (NVIDIA/Radeon RX), or falls back to first device
            dedicated = [d for d in devices if "nvidia" in d.lower() or "geforce" in d.lower() or "rtx" in d.lower() or "rad    eon rx" in d.lower()]
            return dedicated[0] if dedicated else devices[-1]
            
    except Exception:
        return "Detection Failed"


def get_windows_cpu():
    devices = run_wmic_query("wmic cpu get name")
    if devices:
        return devices[0]
    return platform.processor() or "Unknown CPU"


def get_windows_ram_gb():
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    status = MEMORYSTATUSEX()
    status.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        return round(status.ullTotalPhys / (1024 ** 3), 2)
    return 0

def get_specs():
    # Fetch CPU and RAM from Windows using standard libraries.
    cpu_model = get_windows_cpu()
    ram_gb = get_windows_ram_gb()

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
        'success': True,
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
