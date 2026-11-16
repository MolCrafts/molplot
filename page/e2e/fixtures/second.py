import matplotlib.pyplot as plt

figs = []
for index in range(2):
    fig, ax = plt.subplots(figsize=(4, 3))
    ax.plot([0, 1, 2], [index, index + 2, index], label="New curve")
    ax.set_title(f"New figure {index + 1}")
    fig.tight_layout()
    figs.append(fig)
