# 3D Image Classification Lab

Standalone scientific visualization of classical machine learning on real
image data. It is separate from the Atlas code; it does reuse the Three.js
vendor bundle of the neighbouring `nn-3d-simulation` project (a documented
coupling — removing that project breaks this one unless the vendor is copied).

## Verify

```powershell
node experiments\ml-3d-classifier\ml-classifier-test.mjs
```

Four checks: official-split subset sizes, feature/projection shapes, the
browser k-NN reproducing every exported prediction (90/90), and the reported
test accuracy.

## Scientific scope

- **Dataset:** MNIST, using its official train/test separation.
- **Classes in the first edition:** the handwritten digits 1, 4 and 7.
- **Features:** each 28x28 image is average-pooled to 7x7 (49 real numeric
  features), then standardized using the training set only.
- **Classifier:** distance-weighted k-nearest neighbours (k=5). The browser
  recomputes every distance and vote from the exported training vectors.
- **3D view:** PCA fitted on the training features only; it is a visualization
  of the feature space, not the space in which k-NN makes its decision.

The lab must never claim that PCA coordinates determine the prediction: the
classifier uses all 49 standardized features.

## Sources

1. Y. LeCun, C. Cortes and C. J. C. Burges, *The MNIST Database of Handwritten
   Digits* — original dataset documentation:
   https://yann.lecun.com/exdb/mnist/
2. T. Cover and P. Hart (1967), *Nearest Neighbor Pattern Classification*,
   IEEE Transactions on Information Theory 13(1), 21–27.
   https://doi.org/10.1109/TIT.1967.1053964
3. I. T. Jolliffe (2002), *Principal Component Analysis*, 2nd ed., Springer.
   https://doi.org/10.1007/b98835

## Generate the local data

```powershell
& "C:\Users\larjo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" experiments\ml-3d-classifier\scripts\prepare_mnist_knn.py
```

The raw MNIST files are downloaded only for generation and are ignored by Git.
The browser uses the generated JSON files only; it makes no network requests.
