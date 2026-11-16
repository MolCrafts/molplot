import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(4, 3))
ax.plot([0, 1, 2], [0, 1, 0], label="First curve")
ax.set_title("First figure")
ax.set_xlabel("Time")
ax.legend()
fig.tight_layout()
